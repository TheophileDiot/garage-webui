package router

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"khairul169/garage-webui/utils"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
)

type oidcAuth struct {
	config   oauth2.Config
	verifier *oidc.IDTokenVerifier
	groups   []string
}

func validateURL(raw string, originOnly bool) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, errors.New("expected an absolute HTTPS URL without credentials, query or fragment")
	}
	ip := net.ParseIP(u.Hostname())
	loopback := u.Hostname() == "localhost" || (ip != nil && ip.IsLoopback())
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback) {
		return nil, errors.New("HTTPS is required outside loopback development")
	}
	if originOnly && u.Path != "" && u.Path != "/" {
		return nil, errors.New("PUBLIC_URL must contain only the origin; use BASE_PATH for a prefix")
	}
	if originOnly && (u.Host != strings.ToLower(u.Host) || (u.Scheme == "https" && u.Port() == "443") || (u.Scheme == "http" && u.Port() == "80")) {
		return nil, errors.New("PUBLIC_URL must use a lowercase host and omit the default port")
	}
	return u, nil
}

func NewAuth(ctx context.Context) (*Auth, error) {
	public, err := validateURL(os.Getenv("PUBLIC_URL"), true)
	if err != nil {
		return nil, fmt.Errorf("invalid PUBLIC_URL: %w", err)
	}
	basePath := os.Getenv("BASE_PATH")
	if basePath != "" && (!strings.HasPrefix(basePath, "/") || strings.HasSuffix(basePath, "/") || strings.ContainsAny(basePath, "?#%\\") || strings.Contains(basePath, "..") || strings.Contains(basePath, "//")) {
		return nil, errors.New("BASE_PATH must be a clean path prefix without a trailing slash")
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
		return auth, nil
	}
	for _, key := range keys {
		if strings.TrimSpace(os.Getenv(key)) == "" {
			return nil, fmt.Errorf("%s is required for OIDC", key)
		}
	}
	issuer := os.Getenv("OIDC_ISSUER_URL")
	if _, err := validateURL(issuer, false); err != nil {
		return nil, fmt.Errorf("invalid OIDC_ISSUER_URL: %w", err)
	}
	groups := []string{}
	for _, group := range strings.Split(os.Getenv("OIDC_ALLOWED_GROUPS"), ",") {
		if group = strings.TrimSpace(group); group != "" {
			groups = append(groups, group)
		}
	}
	if len(groups) == 0 {
		return nil, errors.New("OIDC_ALLOWED_GROUPS must list at least one administrator group")
	}
	client := &http.Client{Timeout: 10 * time.Second}
	provider, err := oidc.NewProvider(oidc.ClientContext(ctx, client), issuer)
	if err != nil {
		return nil, errors.New("OIDC discovery failed")
	}
	var metadata struct {
		JWKSURL string `json:"jwks_uri"`
	}
	if err := provider.Claims(&metadata); err != nil {
		return nil, errors.New("invalid OIDC discovery metadata")
	}
	endpoint := provider.Endpoint()
	for _, raw := range []string{endpoint.AuthURL, endpoint.TokenURL, metadata.JWKSURL} {
		if _, err := validateURL(raw, false); err != nil {
			return nil, errors.New("OIDC provider endpoints must use HTTPS outside loopback")
		}
	}
	auth.oidc = &oidcAuth{
		config:   oauth2.Config{ClientID: os.Getenv("OIDC_CLIENT_ID"), ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"), RedirectURL: auth.origin + basePath + "/api/auth/oidc/callback", Endpoint: endpoint, Scopes: []string{oidc.ScopeOpenID, oidc.ScopeProfile}},
		verifier: provider.Verifier(&oidc.Config{ClientID: os.Getenv("OIDC_CLIENT_ID")}),
		groups:   groups,
	}
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

func (c *Auth) OIDCCallback(w http.ResponseWriter, r *http.Request) {
	if c.oidc == nil {
		http.NotFound(w, r)
		return
	}
	state, _ := utils.Session.Get(r, "oidc_state").(string)
	nonce, _ := utils.Session.Get(r, "oidc_nonce").(string)
	verifier, _ := utils.Session.Get(r, "oidc_verifier").(string)
	started, _ := utils.Session.Get(r, "oidc_started").(int64)
	for _, key := range []string{"oidc_state", "oidc_nonce", "oidc_verifier", "oidc_started"} {
		utils.Session.Remove(r, key)
	}
	fail := func(code string) { http.Redirect(w, r, c.basePath+"/auth/login?error="+code, http.StatusSeeOther) }
	query := r.URL.Query()
	age := time.Now().Unix() - started
	if state == "" || nonce == "" || verifier == "" || subtle.ConstantTimeCompare([]byte(state), []byte(query.Get("state"))) != 1 || age < 0 || age > 600 || query.Get("error") != "" || query.Get("code") == "" {
		fail("sso_failed")
		return
	}
	ctx := oidc.ClientContext(r.Context(), &http.Client{Timeout: 10 * time.Second})
	token, err := c.oidc.config.Exchange(ctx, query.Get("code"), oauth2.VerifierOption(verifier))
	if err != nil {
		fail("sso_failed")
		return
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		fail("sso_failed")
		return
	}
	idToken, err := c.oidc.verifier.Verify(ctx, raw)
	if err != nil || subtle.ConstantTimeCompare([]byte(idToken.Nonce), []byte(nonce)) != 1 || idToken.Subject == "" {
		fail("sso_failed")
		return
	}
	var claims struct {
		Name     string   `json:"name"`
		Username string   `json:"preferred_username"`
		Groups   []string `json:"groups"`
	}
	if err := idToken.Claims(&claims); err != nil {
		fail("access_denied")
		return
	}
	allowed := false
	for _, actual := range claims.Groups {
		for _, expected := range c.oidc.groups {
			allowed = allowed || actual == expected
		}
	}
	if !allowed {
		fail("access_denied")
		return
	}
	name := claims.Name
	if name == "" {
		name = claims.Username
	}
	if name == "" {
		name = idToken.Subject
	}
	if err := utils.Session.Authenticate(r, name, idToken.Expiry); err != nil {
		fail("sso_failed")
		return
	}
	http.Redirect(w, r, c.basePath+"/", http.StatusSeeOther)
}
