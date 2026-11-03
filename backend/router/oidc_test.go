package router

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"golang.org/x/crypto/bcrypt"
	"khairul169/garage-webui/utils"
)

type oidcFixture struct {
	handler          http.Handler
	issuer           *httptest.Server
	claims           map[string]interface{}
	nonce, challenge string
}

func newOIDCFixture(t *testing.T, prefix string) *oidcFixture {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &oidcFixture{claims: map[string]interface{}{}}
	f.issuer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			json.NewEncoder(w).Encode(map[string]interface{}{
				"issuer": f.issuer.URL, "authorization_endpoint": f.issuer.URL + "/authorize",
				"token_endpoint": f.issuer.URL + "/token", "jwks_uri": f.issuer.URL + "/keys",
				"id_token_signing_alg_values_supported": []string{"RS256"},
			})
		case "/keys":
			json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, Algorithm: "RS256", Use: "sig", KeyID: "test"}}})
		case "/token":
			r.ParseForm()
			digest := sha256.Sum256([]byte(r.Form.Get("code_verifier")))
			user, pass, ok := r.BasicAuth()
			if !ok || user != "garage-webui" || pass != "test-secret" || base64.RawURLEncoding.EncodeToString(digest[:]) != f.challenge {
				http.Error(w, "invalid token request", 400)
				return
			}
			claims := map[string]interface{}{"iss": f.issuer.URL, "aud": "garage-webui", "sub": "operator-1", "iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix(), "nonce": f.nonce, "name": "Garage Operator", "groups": []string{"garage-admins"}}
			for k, v := range f.claims {
				claims[k] = v
			}
			signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, (&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "test"))
			if err != nil {
				t.Error(err)
				http.Error(w, "signing failed", 500)
				return
			}
			token, err := jwt.Signed(signer).Claims(claims).Serialize()
			if err != nil {
				t.Error(err)
				http.Error(w, "signing failed", 500)
				return
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"access_token": "not-for-browser", "token_type": "Bearer", "id_token": token})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(f.issuer.Close)
	t.Setenv("PUBLIC_URL", "http://localhost:3909")
	t.Setenv("BASE_PATH", prefix)
	t.Setenv("AUTH_USER_PASS", "")
	t.Setenv("OIDC_ISSUER_URL", f.issuer.URL)
	t.Setenv("OIDC_CLIENT_ID", "garage-webui")
	t.Setenv("OIDC_CLIENT_SECRET", "test-secret")
	t.Setenv("OIDC_ALLOWED_GROUPS", "garage-admins")
	auth, err := NewAuth(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	mgr := utils.InitSessionManager()
	f.handler = mgr.LoadAndSave(HandleApiRouter(auth))
	return f
}

func request(handler http.Handler, method, path string, cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	return res
}

func (f *oidcFixture) start(t *testing.T) (*http.Cookie, url.Values) {
	t.Helper()
	res := request(f.handler, "GET", "/auth/oidc/login", nil)
	if res.Code != http.StatusFound {
		t.Fatalf("OIDC sign-in: %d %s", res.Code, res.Body.String())
	}
	location, err := url.Parse(res.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	params := location.Query()
	for _, field := range []string{"state", "nonce", "code_challenge"} {
		if len(params.Get(field)) < 32 {
			t.Errorf("missing secure %s", field)
		}
	}
	if params.Get("code_challenge_method") != "S256" {
		t.Fatal("missing PKCE S256")
	}
	f.nonce = params.Get("nonce")
	f.challenge = params.Get("code_challenge")
	return res.Result().Cookies()[0], params
}

func TestOIDCSignInRedirect(t *testing.T) {
	f := newOIDCFixture(t, "")
	_, params := f.start(t)
	if params.Get("redirect_uri") != "http://localhost:3909/api/auth/oidc/callback" {
		t.Fatal(params)
	}
}

func TestOIDCSessionLifecycle(t *testing.T) {
	f := newOIDCFixture(t, "/garage")
	public := request(f.handler, "GET", "/auth/status", nil)
	if public.Code != 200 || !strings.Contains(public.Body.String(), `"authenticated":false`) {
		t.Fatal(public.Body.String())
	}
	cookie, params := f.start(t)
	if !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/garage/" {
		t.Fatalf("unsafe cookie: %v", cookie)
	}
	if params.Get("redirect_uri") != "http://localhost:3909/garage/api/auth/oidc/callback" {
		t.Fatal(params)
	}
	callback := "/auth/oidc/callback?code=test&state=" + url.QueryEscape(params.Get("state"))
	res := request(f.handler, "GET", callback, cookie)
	if res.Code != 303 || res.Header().Get("Location") != "/garage/" {
		t.Fatalf("callback: %d %s", res.Code, res.Header().Get("Location"))
	}
	signedIn := res.Result().Cookies()[0]
	if signedIn.Value == cookie.Value {
		t.Fatal("OIDC did not rotate session")
	}
	status := request(f.handler, "GET", "/auth/status", signedIn)
	if !strings.Contains(status.Body.String(), `"authenticated":true`) || !strings.Contains(status.Body.String(), "Garage Operator") {
		t.Fatal(status.Body.String())
	}
	for _, secret := range []string{"not-for-browser", "test-secret", "operator-1", "garage-admins", "id_token"} {
		if strings.Contains(status.Body.String(), secret) {
			t.Fatalf("identity leaked %s", secret)
		}
	}
	if strings.Contains(request(f.handler, "GET", "/auth/status", cookie).Body.String(), `"authenticated":true`) {
		t.Fatal("old session remains valid")
	}
	replay := request(f.handler, "GET", callback, signedIn)
	if !strings.Contains(replay.Header().Get("Location"), "sso_failed") {
		t.Fatal("callback replay accepted")
	}
	passwordReq := httptest.NewRequest("POST", "/auth/login", strings.NewReader(`{"username":"admin","password":"password"}`))
	passwordReq.Header.Set("Origin", "http://localhost:3909")
	passwordRes := httptest.NewRecorder()
	f.handler.ServeHTTP(passwordRes, passwordReq)
	if passwordRes.Code != 403 {
		t.Fatal("password fallback enabled under OIDC")
	}
	logoutReq := httptest.NewRequest("POST", "/auth/logout", nil)
	logoutReq.AddCookie(signedIn)
	logoutReq.Header.Set("Origin", "http://localhost:3909")
	logoutRes := httptest.NewRecorder()
	f.handler.ServeHTTP(logoutRes, logoutReq)
	if logoutRes.Code != 200 || logoutRes.Result().Cookies()[0].MaxAge >= 0 {
		t.Fatal("logout did not destroy session")
	}
	if strings.Contains(request(f.handler, "GET", "/auth/status", signedIn).Body.String(), `"authenticated":true`) {
		t.Fatal("logged out session reused")
	}
}

func TestOIDCRejectsInvalidIdentity(t *testing.T) {
	for _, tc := range []struct {
		name   string
		claims map[string]interface{}
	}{
		{"nonce", map[string]interface{}{"nonce": "wrong"}},
		{"audience", map[string]interface{}{"aud": "another-client"}},
		{"issuer", map[string]interface{}{"iss": "https://wrong.example"}},
		{"expired", map[string]interface{}{"exp": time.Now().Add(-time.Hour).Unix()}},
		{"subject", map[string]interface{}{"sub": ""}},
		{"group", map[string]interface{}{"groups": []string{"other-group"}}},
		{"missing groups", map[string]interface{}{"groups": nil}},
		{"string groups", map[string]interface{}{"groups": "garage-admins"}},
		{"empty groups", map[string]interface{}{"groups": []string{}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newOIDCFixture(t, "")
			f.claims = tc.claims
			cookie, params := f.start(t)
			res := request(f.handler, "GET", "/auth/oidc/callback?code=test&state="+params.Get("state"), cookie)
			if res.Code != 303 || !strings.Contains(res.Header().Get("Location"), "error=") {
				t.Fatalf("invalid identity accepted: %d %s", res.Code, res.Header().Get("Location"))
			}
			if strings.Contains(request(f.handler, "GET", "/auth/status", cookie).Body.String(), `"authenticated":true`) {
				t.Fatal("invalid identity authenticated")
			}
		})
	}
}

func TestOIDCRejectsStateAndConsumesFailedAttempt(t *testing.T) {
	f := newOIDCFixture(t, "")
	cookie, params := f.start(t)
	wrong := request(f.handler, "GET", "/auth/oidc/callback?code=test&state=wrong", cookie)
	if !strings.Contains(wrong.Header().Get("Location"), "sso_failed") {
		t.Fatal("wrong state accepted")
	}
	retry := request(f.handler, "GET", "/auth/oidc/callback?code=test&state="+params.Get("state"), cookie)
	if !strings.Contains(retry.Header().Get("Location"), "sso_failed") {
		t.Fatal("failed state was not consumed")
	}
	if !strings.Contains(request(f.handler, "GET", "/auth/oidc/callback?code=test", nil).Header().Get("Location"), "sso_failed") {
		t.Fatal("unbound callback accepted")
	}
}

func TestAuthConfigurationFailsClosed(t *testing.T) {
	for _, key := range []string{"AUTH_USER_PASS", "OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_ALLOWED_GROUPS"} {
		t.Setenv(key, "")
	}
	t.Setenv("PUBLIC_URL", "https://garage.example")
	if _, err := NewAuth(context.Background()); err == nil {
		t.Fatal("missing auth accepted")
	}
	t.Setenv("AUTH_USER_PASS", "admin:invalid")
	if _, err := NewAuth(context.Background()); err == nil {
		t.Fatal("invalid bcrypt accepted")
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.MinCost)
	t.Setenv("AUTH_USER_PASS", "admin:"+string(hash))
	if _, err := NewAuth(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Setenv("OIDC_CLIENT_ID", "partial")
	if _, err := NewAuth(context.Background()); err == nil {
		t.Fatal("partial OIDC fell back to password")
	}
	t.Setenv("OIDC_ISSUER_URL", "https://idp.example")
	t.Setenv("OIDC_CLIENT_SECRET", "secret")
	t.Setenv("OIDC_ALLOWED_GROUPS", " , ")
	if _, err := NewAuth(context.Background()); err == nil {
		t.Fatal("empty groups accepted")
	}
	for _, raw := range []string{"http://public.example", "https://user:pass@garage.example", "https://garage.example/path", "https://garage.example?query=1", "https://garage.example#fragment"} {
		if _, err := validateURL(raw, true); err == nil {
			t.Errorf("unsafe public URL accepted: %s", raw)
		}
	}
}

func TestSecureSessionCookie(t *testing.T) {
	t.Setenv("PUBLIC_URL", "https://garage.example")
	mgr := utils.InitSessionManager()
	res := httptest.NewRecorder()
	mgr.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { utils.Session.Set(r, "test", true) })).ServeHTTP(res, httptest.NewRequest("GET", "/", nil))
	cookie := res.Result().Cookies()[0]
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatal("insecure production cookie")
	}
}

func TestOriginProtectsEveryMutationAndProxyDropsCookie(t *testing.T) {
	f := newOIDCFixture(t, "")
	cookie, params := f.start(t)
	res := request(f.handler, "GET", "/auth/oidc/callback?code=test&state="+params.Get("state"), cookie)
	cookie = res.Result().Cookies()[0]
	for _, path := range []string{"/auth/login", "/auth/logout", "/v2/CreateBucket", "/browse/bucket/object"} {
		for _, method := range []string{"POST", "PUT", "PATCH", "DELETE"} {
			for _, origin := range []string{"https://evil.example", ""} {
				req := httptest.NewRequest(method, path, nil)
				req.AddCookie(cookie)
				req.Header.Set("Origin", origin)
				res := httptest.NewRecorder()
				f.handler.ServeHTTP(res, req)
				if res.Code != 403 {
					t.Fatalf("%s %s origin %q accepted: %d", method, path, origin, res.Code)
				}
			}
		}
	}
	garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") != "" {
			t.Error("session cookie forwarded to Garage")
		}
		if r.Header.Get("Authorization") != "Bearer garage-admin-token" {
			t.Error("wrong upstream authorization")
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "storageNodesUp": 4})
	}))
	defer garage.Close()
	t.Setenv("API_BASE_URL", garage.URL)
	t.Setenv("API_ADMIN_KEY", "garage-admin-token")
	req := httptest.NewRequest("POST", "/v2/CreateBucket", strings.NewReader("{}"))
	req.AddCookie(cookie)
	req.Header.Set("X-Requested-With", "garage-webui")
	req.Header.Set("Authorization", "Bearer browser-token")
	forwarded := httptest.NewRecorder()
	f.handler.ServeHTTP(forwarded, req)
	if forwarded.Code != 200 {
		t.Fatalf("valid CLI mutation failed: %d", forwarded.Code)
	}
}

func TestRejectsNonCanonicalPublicOrigins(t *testing.T) {
	for _, raw := range []string{"https://GARAGE.example", "https://garage.example:443", "http://localhost:80"} {
		if _, err := validateURL(raw, true); err == nil {
			t.Errorf("non-canonical browser origin accepted: %s", raw)
		}
	}
}

func TestOIDCRejectsInsecureDiscoveryEndpoints(t *testing.T) {
	for _, field := range []string{"authorization_endpoint", "token_endpoint", "jwks_uri"} {
		t.Run(field, func(t *testing.T) {
			var server *httptest.Server
			server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				metadata := map[string]string{"issuer": server.URL, "authorization_endpoint": server.URL + "/authorize", "token_endpoint": server.URL + "/token", "jwks_uri": server.URL + "/keys"}
				metadata[field] = "http://identity.example/insecure"
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(metadata)
			}))
			defer server.Close()
			t.Setenv("PUBLIC_URL", "https://garage.example")
			t.Setenv("BASE_PATH", "")
			t.Setenv("OIDC_ISSUER_URL", server.URL)
			t.Setenv("OIDC_CLIENT_ID", "garage-webui")
			t.Setenv("OIDC_CLIENT_SECRET", "test-secret")
			t.Setenv("OIDC_ALLOWED_GROUPS", "garage-admins")
			if _, err := NewAuth(context.Background()); err == nil {
				t.Fatal("insecure discovered endpoint accepted")
			}
		})
	}
}
