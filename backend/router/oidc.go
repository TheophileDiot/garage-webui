package router

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"io"
	"khairul169/garage-webui/middleware"
	"khairul169/garage-webui/utils"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
)

type oidcAuth struct {
	config   oauth2.Config
	verifier *oidc.IDTokenVerifier
	groups   []string
	now      func() time.Time

	revocationURL string
	// Refresh state lives here, not in the SCS session: SCS rewrites the whole session at the end
	// of every request, so a concurrent request could put an already rotated refresh token back.
	// The session holds only the immutable grant ID.
	gmu    sync.Mutex
	grants map[string]*oidcGrant
}

type oidcGrant struct {
	mu           sync.Mutex // serialises the refresh and the logout of this grant
	refreshToken string
	subject      string
	nonce        string
	idExpiry     time.Time
	created      time.Time
	ended        bool
}

const refreshMargin = 30 * time.Second

// validateURL accepts an absolute HTTPS URL, or HTTP on loopback, without credentials, query or fragment.
func validateURL(raw string) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, errors.New("expected an absolute HTTPS URL without credentials, query or fragment")
	}
	ip := net.ParseIP(u.Hostname())
	loopback := u.Hostname() == "localhost" || (ip != nil && ip.IsLoopback())
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback) {
		return nil, errors.New("HTTPS is required outside loopback development")
	}
	return u, nil
}

// validateOrigin additionally requires the canonical form of a browser origin.
func validateOrigin(raw string) (*url.URL, error) {
	u, err := validateURL(raw)
	if err != nil {
		return nil, err
	}
	if u.Path != "" && u.Path != "/" {
		return nil, errors.New("PUBLIC_URL must contain only the origin; use BASE_PATH for a prefix")
	}
	if u.Host != strings.ToLower(u.Host) || (u.Scheme == "https" && u.Port() == "443") || (u.Scheme == "http" && u.Port() == "80") {
		return nil, errors.New("PUBLIC_URL must use a lowercase host and omit the default port")
	}
	return u, nil
}

func validateBasePath(basePath string) error {
	if basePath != "" && (!strings.HasPrefix(basePath, "/") || strings.HasSuffix(basePath, "/") || strings.ContainsAny(basePath, "?#%\\") || strings.Contains(basePath, "..") || strings.Contains(basePath, "//")) {
		return errors.New("BASE_PATH must be a clean path prefix without a trailing slash")
	}
	return nil
}

// parseGroups splits OIDC_ALLOWED_GROUPS into its non-empty, trimmed names.
func parseGroups(raw string) []string {
	groups := []string{}
	for _, group := range strings.Split(raw, ",") {
		if group = strings.TrimSpace(group); group != "" {
			groups = append(groups, group)
		}
	}
	return groups
}

func NewAuth(ctx context.Context) (*Auth, error) {
	public, err := validateOrigin(os.Getenv("PUBLIC_URL"))
	if err != nil {
		return nil, fmt.Errorf("invalid PUBLIC_URL: %w", err)
	}
	basePath := os.Getenv("BASE_PATH")
	if err := validateBasePath(basePath); err != nil {
		return nil, err
	}
	auth := &Auth{origin: public.Scheme + "://" + public.Host, basePath: basePath}
	keys := []string{"OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_ALLOWED_GROUPS"}
	configured := false
	for _, key := range keys {
		configured = configured || os.Getenv(key) != ""
	}
	if !configured {
		username, hash, ok := strings.Cut(os.Getenv("AUTH_USER_PASS"), ":")
		if !ok || username == "" {
			return nil, errors.New("configure OIDC or AUTH_USER_PASS; anonymous access is disabled")
		}
		if _, err := bcrypt.Cost([]byte(hash)); err != nil {
			return nil, errors.New("AUTH_USER_PASS requires username:bcrypt_hash")
		}
		auth.localUser, auth.localHash = username, hash
		return auth, nil
	}
	for _, key := range keys {
		if strings.TrimSpace(os.Getenv(key)) == "" {
			return nil, fmt.Errorf("%s is required for OIDC", key)
		}
	}
	issuer := os.Getenv("OIDC_ISSUER_URL")
	if _, err := validateURL(issuer); err != nil {
		return nil, fmt.Errorf("invalid OIDC_ISSUER_URL: %w", err)
	}
	groups := parseGroups(os.Getenv("OIDC_ALLOWED_GROUPS"))
	if len(groups) == 0 {
		return nil, errors.New("OIDC_ALLOWED_GROUPS must list at least one administrator group")
	}
	client := &http.Client{Timeout: 10 * time.Second}
	provider, err := oidc.NewProvider(oidc.ClientContext(ctx, client), issuer)
	if err != nil {
		return nil, errors.New("OIDC discovery failed")
	}
	var metadata struct {
		JWKSURL       string `json:"jwks_uri"`
		RevocationURL string `json:"revocation_endpoint"`
	}
	if err := provider.Claims(&metadata); err != nil {
		return nil, errors.New("invalid OIDC discovery metadata")
	}
	endpoint := provider.Endpoint()
	for _, raw := range []string{endpoint.AuthURL, endpoint.TokenURL, metadata.JWKSURL} {
		if _, err := validateURL(raw); err != nil {
			return nil, errors.New("OIDC provider endpoints must use HTTPS outside loopback")
		}
	}
	if metadata.RevocationURL != "" {
		if _, err := validateURL(metadata.RevocationURL); err != nil {
			log.Print("OIDC revocation_endpoint ignored: it must use HTTPS outside loopback; refresh tokens will not be revoked at sign-out")
			metadata.RevocationURL = ""
		}
	}
	oa := &oidcAuth{
		config:        oauth2.Config{ClientID: os.Getenv("OIDC_CLIENT_ID"), ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"), RedirectURL: auth.origin + basePath + "/api/auth/oidc/callback", Endpoint: endpoint, Scopes: []string{oidc.ScopeOpenID, oidc.ScopeProfile, oidc.ScopeOfflineAccess}},
		groups:        groups,
		now:           time.Now,
		revocationURL: metadata.RevocationURL,
		grants:        map[string]*oidcGrant{},
	}
	oa.verifier = provider.Verifier(&oidc.Config{ClientID: os.Getenv("OIDC_CLIENT_ID"), Now: func() time.Time { return oa.now() }})
	auth.oidc = oa
	return auth, nil
}

func (c *Auth) OIDCLogin(w http.ResponseWriter, r *http.Request) {
	if c.oidc == nil {
		http.NotFound(w, r)
		return
	}
	if err := utils.Session.Renew(r); err != nil {
		http.Error(w, "could not start sign-in", 500)
		return
	}
	state, nonce, verifier := oauth2.GenerateVerifier(), oauth2.GenerateVerifier(), oauth2.GenerateVerifier()
	utils.Session.Set(r, "oidc_state", state)
	utils.Session.Set(r, "oidc_nonce", nonce)
	utils.Session.Set(r, "oidc_verifier", verifier)
	utils.Session.Set(r, "oidc_started", time.Now().Unix())
	location := c.oidc.config.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier))
	http.Redirect(w, r, location, http.StatusFound)
}

// OIDCCallback finishes a sign-in. Every outcome is audited with a fixed outcome name: never the
// code, the state, a token or the provider's own error text.
func (c *Auth) OIDCCallback(w http.ResponseWriter, r *http.Request) {
	if c.oidc == nil {
		http.NotFound(w, r)
		return
	}
	rec := middleware.Audit(r)
	if rec == nil {
		rec = &middleware.AuditRecord{} // not audited: the writes below go nowhere
	}
	rec.Always, rec.Target = true, map[string]string{"outcome": "error"}
	state, _ := utils.Session.Get(r, "oidc_state").(string)
	nonce, _ := utils.Session.Get(r, "oidc_nonce").(string)
	verifier, _ := utils.Session.Get(r, "oidc_verifier").(string)
	started, _ := utils.Session.Get(r, "oidc_started").(int64)
	for _, key := range []string{"oidc_state", "oidc_nonce", "oidc_verifier", "oidc_started"} {
		utils.Session.Remove(r, key)
	}
	fail := func(code, outcome string) {
		rec.Target["outcome"] = outcome
		http.Redirect(w, r, c.basePath+"/auth/login?error="+code, http.StatusSeeOther)
	}
	query := r.URL.Query()
	age := time.Now().Unix() - started
	switch {
	case query.Get("error") != "":
		fail("sso_failed", "provider_error")
		return
	case state == "" || nonce == "" || verifier == "" || subtle.ConstantTimeCompare([]byte(state), []byte(query.Get("state"))) != 1 || age < 0 || age > 600 || query.Get("code") == "":
		fail("sso_failed", "state_invalid")
		return
	}
	ctx := oidc.ClientContext(r.Context(), &http.Client{Timeout: 10 * time.Second})
	token, err := c.oidc.config.Exchange(ctx, query.Get("code"), oauth2.VerifierOption(verifier))
	if err != nil {
		fail("sso_failed", "exchange_failed")
		return
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		fail("sso_failed", "token_invalid")
		return
	}
	idToken, err := c.oidc.verifier.Verify(ctx, raw)
	if err != nil || subtle.ConstantTimeCompare([]byte(idToken.Nonce), []byte(nonce)) != 1 || idToken.Subject == "" {
		fail("sso_failed", "token_invalid")
		return
	}
	// The ID token is verified, so its subject is known from here on.
	rec.Actor = utils.Actor{Kind: "oidc", Subject: idToken.Subject}
	var claims struct {
		Name     string   `json:"name"`
		Username string   `json:"preferred_username"`
		Groups   []string `json:"groups"`
	}
	if err := idToken.Claims(&claims); err != nil {
		fail("access_denied", "claims_invalid")
		return
	}
	if !c.oidc.allowed(claims.Groups) {
		fail("access_denied", "group_denied")
		return
	}
	name := claims.Name
	if name == "" {
		name = claims.Username
	}
	if name == "" {
		name = idToken.Subject
	}
	rec.Actor.Name = name
	expiry, grantID := idToken.Expiry, ""
	if token.RefreshToken != "" {
		expiry = c.oidc.now().Add(utils.SessionLifetime)
		grantID = c.oidc.addGrant(&oidcGrant{refreshToken: token.RefreshToken, subject: idToken.Subject, nonce: idToken.Nonce, idExpiry: idToken.Expiry, created: c.oidc.now()})
	} else {
		log.Print("OIDC sign-in without a refresh token: refresh unavailable, the session ends when the ID token expires")
	}
	previous, _ := utils.Session.Get(r, "oidc_grant").(string)
	if err := utils.Session.Authenticate(r, rec.Actor, expiry); err != nil {
		c.oidc.endGrant(ctx, grantID, false)
		fail("sso_failed", "session_failed")
		return
	}
	utils.Session.Remove(r, "oidc_grant")
	c.oidc.endGrant(ctx, previous, true)
	if grantID != "" {
		utils.Session.Set(r, "oidc_grant", grantID)
	}
	rec.Target["outcome"] = "success"
	http.Redirect(w, r, c.basePath+"/", http.StatusSeeOther)
}

func (a *oidcAuth) allowed(groups []string) bool {
	return slices.ContainsFunc(groups, func(actual string) bool { return slices.Contains(a.groups, actual) })
}

func (a *oidcAuth) addGrant(g *oidcGrant) string {
	id := rand.Text()
	a.gmu.Lock()
	defer a.gmu.Unlock()
	cutoff := a.now().Add(-utils.SessionLifetime)
	for key, old := range a.grants {
		if old.created.Before(cutoff) {
			delete(a.grants, key)
		}
	}
	a.grants[id] = g
	return id
}

func (a *oidcAuth) grant(id string) *oidcGrant {
	a.gmu.Lock()
	defer a.gmu.Unlock()
	return a.grants[id]
}

// drop ends g for good; the caller holds g.mu.
func (a *oidcAuth) drop(id string, g *oidcGrant) {
	g.ended, g.refreshToken = true, ""
	a.gmu.Lock()
	delete(a.grants, id)
	a.gmu.Unlock()
}

// Authenticated reports whether the request has a live session. For an OIDC session that holds a
// grant it first renews an expired ID token, which re-checks identity and group membership.
func (c *Auth) Authenticated(r *http.Request) bool {
	if !utils.Session.Authenticated(r) {
		return false
	}
	id, _ := utils.Session.Get(r, "oidc_grant").(string)
	if c.oidc == nil || id == "" || c.oidc.fresh(r.Context(), id) {
		return true
	}
	_ = utils.Session.Destroy(r)
	return false
}

// fresh makes sure the grant's ID token is valid for at least refreshMargin more. Concurrent
// callers queue on the grant, so the token endpoint sees one refresh and the others reuse it.
func (a *oidcAuth) fresh(ctx context.Context, id string) bool {
	g := a.grant(id)
	if g == nil {
		return false
	}
	ok, revoke := a.refreshGrant(ctx, id, g)
	// Outside the grant lock, so queued requests are not held up by the IdP call.
	a.revoke(context.WithoutCancel(ctx), revoke)
	return ok
}

// refreshGrant returns the refresh token to revoke when a refresh the IdP accepted was then rejected.
func (a *oidcAuth) refreshGrant(ctx context.Context, id string, g *oidcGrant) (ok bool, revoke string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.ended {
		return false, ""
	}
	if g.idExpiry.Sub(a.now()) > refreshMargin {
		return true, ""
	}
	revoke, err := a.renew(ctx, g)
	if err != nil {
		log.Printf("OIDC refresh failed, session ended: %v", err)
		a.drop(id, g)
		return false, revoke
	}
	return true, ""
}

// renew errors are fixed strings: the token endpoint's own messages could echo token material.
// Once the token endpoint answered, every error also returns the token the session then held (the
// rotated one if issued), which the caller revokes; before that there is nothing valid to revoke.
func (a *oidcAuth) renew(ctx context.Context, g *oidcGrant) (string, error) {
	// A client that disconnects mid-refresh must not strand a rotated refresh token.
	ctx = oidc.ClientContext(context.WithoutCancel(ctx), &http.Client{Timeout: 10 * time.Second})
	token, err := a.config.TokenSource(ctx, &oauth2.Token{RefreshToken: g.refreshToken}).Token()
	if err != nil {
		var rejected *oauth2.RetrieveError
		if errors.As(err, &rejected) {
			return "", errors.New("token endpoint refused the refresh token")
		}
		return "", errors.New("token endpoint unreachable")
	}
	held := g.refreshToken
	if token.RefreshToken != "" {
		held = token.RefreshToken
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		return held, errors.New("response has no id_token")
	}
	idToken, err := a.verifier.Verify(ctx, raw)
	if err != nil {
		return held, errors.New("id_token verification failed")
	}
	if idToken.Subject != g.subject || (idToken.Nonce != "" && idToken.Nonce != g.nonce) {
		return held, errors.New("id_token subject or nonce changed")
	}
	var claims struct {
		Groups []string `json:"groups"`
	}
	if idToken.Claims(&claims) != nil || !a.allowed(claims.Groups) {
		return held, errors.New("user is no longer in an allowed group")
	}
	g.refreshToken = held
	g.idExpiry = idToken.Expiry
	return "", nil
}

// endGrant forgets a grant and, when revoke is set, revokes its refresh token at the IdP.
func (a *oidcAuth) endGrant(ctx context.Context, id string, revoke bool) {
	g := a.grant(id)
	if g == nil {
		return
	}
	g.mu.Lock()
	token := g.refreshToken
	a.drop(id, g)
	g.mu.Unlock()
	if revoke {
		a.revoke(context.WithoutCancel(ctx), token)
	}
}

// revoke is best effort (RFC 7009): a failure is logged and never blocks sign-out.
func (a *oidcAuth) revoke(ctx context.Context, token string) {
	if a.revocationURL == "" || token == "" {
		return
	}
	client := &http.Client{Timeout: 10 * time.Second}
	// Same client authentication as the token endpoint: HTTP Basic first, body parameters if refused.
	for _, inBody := range []bool{false, true} {
		form := url.Values{"token": {token}, "token_type_hint": {"refresh_token"}}
		if inBody {
			form.Set("client_id", a.config.ClientID)
			form.Set("client_secret", a.config.ClientSecret)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.revocationURL, strings.NewReader(form.Encode()))
		if err != nil {
			break
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		if !inBody {
			req.SetBasicAuth(url.QueryEscape(a.config.ClientID), url.QueryEscape(a.config.ClientSecret))
		}
		res, err := client.Do(req)
		if err != nil {
			break
		}
		io.Copy(io.Discard, io.LimitReader(res.Body, 4096))
		res.Body.Close()
		if res.StatusCode < 300 {
			return
		}
		if res.StatusCode != http.StatusBadRequest && res.StatusCode != http.StatusUnauthorized {
			break
		}
	}
	log.Print("OIDC refresh token revocation failed; the token stays valid at the identity provider until it expires")
}
