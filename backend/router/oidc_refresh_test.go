package router

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

const idLifetime = 5 * time.Minute

func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	return &buf
}

func (f *oidcFixture) login(t *testing.T) *http.Cookie {
	t.Helper()
	cookie, params := f.start(t)
	res := request(f.handler, "GET", "/auth/oidc/callback?code=test&state="+url.QueryEscape(params.Get("state")), cookie)
	if res.Code != 303 || strings.Contains(res.Header().Get("Location"), "error=") {
		t.Fatalf("callback: %d %s", res.Code, res.Header().Get("Location"))
	}
	return res.Result().Cookies()[0]
}

func (f *oidcFixture) api(cookie *http.Cookie) int {
	return request(f.handler, "GET", "/config", cookie).Code
}

func (f *oidcFixture) signedIn(cookie *http.Cookie) bool {
	return strings.Contains(request(f.handler, "GET", "/auth/status", cookie).Body.String(), `"authenticated":true`)
}

func (f *oidcFixture) logout(cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest("POST", "/auth/logout", nil)
	req.AddCookie(cookie)
	req.Header.Set("Origin", "http://localhost:3909")
	res := httptest.NewRecorder()
	f.handler.ServeHTTP(res, req)
	return res
}

func (f *oidcFixture) grants() int {
	f.auth.oidc.gmu.Lock()
	defer f.auth.oidc.gmu.Unlock()
	return len(f.auth.oidc.grants)
}

func (f *oidcFixture) seenTokens() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.seen...)
}

func TestOIDCRequestsOfflineAccess(t *testing.T) {
	f := newOIDCFixture(t, "")
	_, params := f.start(t)
	if scope := params.Get("scope"); scope != "openid profile offline_access" {
		t.Fatalf("scopes: %q", scope)
	}
	if params.Has("prompt") {
		t.Fatal("prompt must not be forced")
	}
}

func TestOIDCRefreshKeepsSessionPastIDTokenExpiry(t *testing.T) {
	logs := captureLog(t)
	f := newOIDCFixture(t, "")
	f.idTTL = idLifetime
	cookie := f.login(t)
	if f.api(cookie) != 200 || f.refreshCalls.Load() != 0 {
		t.Fatal("fresh ID token must not refresh")
	}
	f.advance(idLifetime - 20*time.Second) // inside the 30 s margin
	if f.api(cookie) != 200 || f.refreshCalls.Load() != 1 {
		t.Fatalf("no early refresh: calls=%d", f.refreshCalls.Load())
	}
	if !f.signedIn(cookie) || f.api(cookie) != 200 || f.refreshCalls.Load() != 1 {
		t.Fatalf("refreshed token not reused: calls=%d", f.refreshCalls.Load())
	}
	f.advance(2 * idLifetime)
	if f.api(cookie) != 200 || f.refreshCalls.Load() != 2 {
		t.Fatalf("expired ID token not refreshed: calls=%d", f.refreshCalls.Load())
	}
	if strings.Contains(logs.String(), "refresh-") || strings.Contains(logs.String(), "not-for-browser") {
		t.Fatalf("token logged: %s", logs)
	}
}

func TestOIDCRotatedRefreshTokenIsStoredAndUsed(t *testing.T) {
	f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.rotate = true; f.idTTL = idLifetime })
	cookie := f.login(t)
	for i := 0; i < 3; i++ {
		f.advance(2 * idLifetime)
		if f.api(cookie) != 200 {
			t.Fatalf("refresh %d failed", i)
		}
	}
	// The fake IdP rejects a token it already rotated, so a stale one would end the session.
	if got := strings.Join(f.seenTokens(), ","); got != "refresh-1,refresh-2,refresh-3" {
		t.Fatalf("tokens presented: %s", got)
	}
}

func TestOIDCRefreshFailureEndsSession(t *testing.T) {
	for _, tc := range []struct {
		name  string
		setup func(*oidcFixture)
	}{
		{"invalid_grant", func(f *oidcFixture) { f.refreshMode = "invalid_grant" }},
		{"missing id_token", func(f *oidcFixture) { f.refreshMode = "no_id_token" }},
		{"changed subject", func(f *oidcFixture) { f.refreshClaim = map[string]interface{}{"sub": "operator-2"} }},
		{"changed nonce", func(f *oidcFixture) { f.refreshClaim = map[string]interface{}{"nonce": "another"} }},
		{"removed from group", func(f *oidcFixture) { f.refreshClaim = map[string]interface{}{"groups": []string{"other"}} }},
		{"missing groups", func(f *oidcFixture) { f.refreshClaim = map[string]interface{}{"groups": nil} }},
		{"wrong audience", func(f *oidcFixture) { f.refreshClaim = map[string]interface{}{"aud": "another-client"} }},
		{"expired id_token", func(f *oidcFixture) {
			f.refreshClaim = map[string]interface{}{"exp": time.Now().Add(-time.Hour).Unix()}
		}},
	} {
		for _, via := range []string{"api", "status"} {
			t.Run(tc.name+"/"+via, func(t *testing.T) {
				f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.idTTL = idLifetime })
				cookie := f.login(t)
				tc.setup(f)
				f.advance(2 * idLifetime)
				if via == "api" {
					if code := f.api(cookie); code != 401 {
						t.Fatalf("protected route: %d", code)
					}
				} else if f.signedIn(cookie) {
					t.Fatal("status still authenticated")
				}
				if f.api(cookie) != 401 || f.signedIn(cookie) {
					t.Fatal("session survived the failed refresh")
				}
				if f.refreshCalls.Load() != 1 {
					t.Fatalf("dead session hit the IdP again: %d calls", f.refreshCalls.Load())
				}
				if f.grants() != 0 {
					t.Fatal("grant kept after failure")
				}
			})
		}
	}
}

func TestOIDCWithoutRefreshTokenKeepsIDTokenLifetime(t *testing.T) {
	logs := captureLog(t)
	f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.noRefresh = true; f.idTTL = idLifetime })
	cookie := f.login(t)
	if n := strings.Count(logs.String(), "refresh unavailable"); n != 1 {
		t.Fatalf("expected one log line, got %d: %s", n, logs)
	}
	if f.grants() != 0 || f.api(cookie) != 200 {
		t.Fatal("session without refresh token must still work")
	}
	f.advance(idLifetime + time.Minute)
	if f.api(cookie) != 401 || f.signedIn(cookie) {
		t.Fatal("session outlived the ID token")
	}
	if f.refreshCalls.Load() != 0 {
		t.Fatal("refresh attempted without a refresh token")
	}
}

func TestOIDCParallelRequestsRefreshOnce(t *testing.T) {
	f := newOIDCFixtureWith(t, "", func(f *oidcFixture) {
		f.rotate = true
		f.idTTL = idLifetime
		f.refreshDelay = 150 * time.Millisecond
	})
	cookie := f.login(t)
	f.advance(2 * idLifetime)
	var wg sync.WaitGroup
	codes := make([]int, 12)
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			codes[i] = f.api(cookie)
		}()
	}
	wg.Wait()
	for i, code := range codes {
		if code != 200 {
			t.Fatalf("request %d: %d", i, code)
		}
	}
	if f.refreshCalls.Load() != 1 {
		t.Fatalf("token endpoint called %d times", f.refreshCalls.Load())
	}
	if !f.signedIn(cookie) || f.refreshCalls.Load() != 1 {
		t.Fatal("session unusable after parallel refresh")
	}
	// A request that loaded the session before the refresh must not restore an older token.
	f.advance(2 * idLifetime)
	if f.api(cookie) != 200 {
		t.Fatal("second refresh failed")
	}
	if got := strings.Join(f.seenTokens(), ","); got != "refresh-1,refresh-2" {
		t.Fatalf("tokens presented: %s", got)
	}
}

func TestOIDCLogoutRevokesCurrentRefreshToken(t *testing.T) {
	for _, status := range []int{0, 500} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			logs := captureLog(t)
			f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.rotate = true; f.idTTL = idLifetime; f.revokeStatus = status })
			cookie := f.login(t)
			f.advance(2 * idLifetime)
			if f.api(cookie) != 200 {
				t.Fatal("refresh failed")
			}
			res := f.logout(cookie)
			if res.Code != 200 || res.Result().Cookies()[0].MaxAge >= 0 {
				t.Fatalf("logout failed: %d", res.Code)
			}
			f.mu.Lock()
			revoked := f.revoked
			f.mu.Unlock()
			if len(revoked) != 1 || revoked[0].Get("token") != "refresh-2" || revoked[0].Get("token_type_hint") != "refresh_token" {
				t.Fatalf("revocation requests: %v", revoked)
			}
			if f.signedIn(cookie) || f.grants() != 0 {
				t.Fatal("logout kept the session or the grant")
			}
			if strings.Contains(logs.String(), "refresh-") {
				t.Fatalf("token logged: %s", logs)
			}
			if status != 0 && !strings.Contains(logs.String(), "revocation failed") {
				t.Fatalf("revocation failure not logged: %s", logs)
			}
		})
	}
}

func TestOIDCLogoutWithoutRefreshTokenDoesNotRevoke(t *testing.T) {
	f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.noRefresh = true })
	cookie := f.login(t)
	if res := f.logout(cookie); res.Code != 200 {
		t.Fatalf("logout: %d", res.Code)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.revoked) != 0 {
		t.Fatal("revocation without a refresh token")
	}
}

func TestOIDCRevocationEndpointMustBeSecure(t *testing.T) {
	logs := captureLog(t)
	f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.revocation = "http://identity.example/revoke" })
	if f.auth.oidc.revocationURL != "" || !strings.Contains(logs.String(), "revocation_endpoint") {
		t.Fatalf("insecure revocation endpoint kept: %q %s", f.auth.oidc.revocationURL, logs)
	}
	cookie := f.login(t)
	if res := f.logout(cookie); res.Code != 200 {
		t.Fatalf("logout: %d", res.Code)
	}
	if g := newOIDCFixture(t, ""); g.auth.oidc.revocationURL != g.issuer.URL+"/revoke" {
		t.Fatalf("loopback revocation endpoint dropped: %q", g.auth.oidc.revocationURL)
	}
}

func TestOIDCGrantsAreBounded(t *testing.T) {
	f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.idTTL = idLifetime })
	f.login(t)
	f.login(t)
	if f.grants() != 2 {
		t.Fatalf("grants: %d", f.grants())
	}
	f.advance(9 * time.Hour)
	f.login(t)
	if f.grants() != 1 {
		t.Fatalf("stale grants not swept: %d", f.grants())
	}
}

func TestOIDCRefreshTokenNeverReachesBrowser(t *testing.T) {
	f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.rotate = true; f.idTTL = idLifetime })
	cookie, params := f.start(t)
	callback := request(f.handler, "GET", "/auth/oidc/callback?code=test&state="+url.QueryEscape(params.Get("state")), cookie)
	cookie = callback.Result().Cookies()[0]
	f.advance(2 * idLifetime)
	responses := []*httptest.ResponseRecorder{callback, request(f.handler, "GET", "/auth/status", cookie), request(f.handler, "GET", "/config", cookie), f.logout(cookie)}
	for _, res := range responses {
		dump := res.Body.String() + "\n" + strings.Join(res.Header().Values("Set-Cookie"), "\n") + "\n" + res.Header().Get("Location")
		if strings.Contains(dump, "refresh-") {
			t.Fatalf("refresh token in response: %s", dump)
		}
	}
}

func TestOIDCRevocationFallsBackToBodyClientAuth(t *testing.T) {
	f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.revokeBody = true })
	cookie := f.login(t)
	f.logout(cookie)
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.revoked) != 1 || f.revoked[0].Get("token") != "refresh-1" {
		t.Fatalf("revocation requests: %v", f.revoked)
	}
}

func TestOIDCRejectedRefreshRevokesRotatedToken(t *testing.T) {
	for _, tc := range []struct {
		name  string
		setup func(*oidcFixture)
		want  string
	}{
		{"removed from group", func(f *oidcFixture) { f.refreshClaim = map[string]interface{}{"groups": []string{"other"}} }, "refresh-2"},
		{"changed subject", func(f *oidcFixture) { f.refreshClaim = map[string]interface{}{"sub": "operator-2"} }, "refresh-2"},
		{"missing id_token", func(f *oidcFixture) { f.refreshMode = "no_id_token" }, "refresh-2"},
		{"invalid_grant", func(f *oidcFixture) { f.refreshMode = "invalid_grant" }, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			logs := captureLog(t)
			f := newOIDCFixtureWith(t, "", func(f *oidcFixture) { f.rotate = true; f.idTTL = idLifetime })
			cookie := f.login(t)
			tc.setup(f)
			f.advance(2 * idLifetime)
			if f.api(cookie) != 401 {
				t.Fatal("session survived")
			}
			f.mu.Lock()
			revoked := f.revoked
			f.mu.Unlock()
			if tc.want == "" {
				if len(revoked) != 0 {
					t.Fatalf("revoked after a refused refresh: %v", revoked)
				}
			} else if len(revoked) != 1 || revoked[0].Get("token") != tc.want || revoked[0].Get("token_type_hint") != "refresh_token" {
				t.Fatalf("revocation requests: %v", revoked)
			}
			if strings.Contains(logs.String(), "refresh-") {
				t.Fatalf("token logged: %s", logs)
			}
		})
	}
}
