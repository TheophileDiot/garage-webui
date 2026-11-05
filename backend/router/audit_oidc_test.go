package router

import (
	"net/url"
	"strings"
	"testing"
)

func TestAuditOIDCCallbackSuccess(t *testing.T) {
	f := newOIDCFixture(t, "")
	cookie, params := f.start(t)
	stop := captureStdout(t)
	res := request(f.handler, "GET", "/auth/oidc/callback?code=SECRETCODE&state="+url.QueryEscape(params.Get("state")), cookie)
	lines := stop()
	if res.Code != 303 || strings.Contains(res.Header().Get("Location"), "error=") {
		t.Fatalf("callback: %d %s", res.Code, res.Header().Get("Location"))
	}
	got := parseAudit(t, lines)
	if len(got) != 1 {
		t.Fatalf("want one audit line, got %v", lines)
	}
	l := got[0]
	if l.Event != "mutation" || l.Method != "GET" || l.Operation != "GET /auth/oidc/callback" || l.Status != 303 || l.Target["outcome"] != "success" {
		t.Errorf("line: %+v", l)
	}
	if l.Actor["kind"] != "oidc" || l.Actor["sub"] != "operator-1" || l.Actor["name"] != "Garage Operator" {
		t.Errorf("actor: %+v", l.Actor)
	}
	assertNoSecrets(t, lines, "SECRETCODE", params.Get("state"), f.nonce, f.challenge, "garage-admins")
}

func TestAuditOIDCCallbackFailures(t *testing.T) {
	for _, tc := range []struct {
		name    string
		setup   func(*oidcFixture)
		target  func(state string) string
		outcome string
		actor   string // expected actor kind
		sub     string
	}{
		{"wrong state", nil, func(string) string { return "/auth/oidc/callback?code=SECRETCODE&state=SECRETSTATE" }, "state_invalid", "anonymous", ""},
		{"provider error", nil, func(s string) string {
			return "/auth/oidc/callback?error=access_denied&error_description=SECRETPROVIDER&state=" + url.QueryEscape(s)
		}, "provider_error", "anonymous", ""},
		{"no code", nil, func(s string) string { return "/auth/oidc/callback?state=" + url.QueryEscape(s) }, "state_invalid", "anonymous", ""},
		{"exchange refused", func(f *oidcFixture) { f.challenge = "mismatch" }, nil, "exchange_failed", "anonymous", ""},
		{"bad nonce", func(f *oidcFixture) { f.claims = map[string]interface{}{"nonce": "wrong"} }, nil, "token_invalid", "anonymous", ""},
		{"group denied", func(f *oidcFixture) { f.claims = map[string]interface{}{"groups": []string{"other"}} }, nil, "group_denied", "oidc", "operator-1"},
		{"invalid groups claim", func(f *oidcFixture) { f.claims = map[string]interface{}{"groups": "garage-admins"} }, nil, "claims_invalid", "oidc", "operator-1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newOIDCFixture(t, "")
			cookie, params := f.start(t)
			if tc.setup != nil {
				tc.setup(f) // after start, so the nonce and challenge it recorded can be broken
			}
			target := "/auth/oidc/callback?code=SECRETCODE&state=" + url.QueryEscape(params.Get("state"))
			if tc.target != nil {
				target = tc.target(params.Get("state"))
			}
			stop := captureStdout(t)
			res := request(f.handler, "GET", target, cookie)
			lines := stop()
			if res.Code != 303 || !strings.Contains(res.Header().Get("Location"), "error=") {
				t.Fatalf("failure not redirected: %d %s", res.Code, res.Header().Get("Location"))
			}
			got := parseAudit(t, lines)
			if len(got) != 1 {
				t.Fatalf("want one audit line, got %v", lines)
			}
			l := got[0]
			if l.Method != "GET" || l.Operation != "GET /auth/oidc/callback" || l.Status != 303 || l.Target["outcome"] != tc.outcome {
				t.Errorf("line: %+v", l)
			}
			if l.Actor["kind"] != tc.actor || l.Actor["sub"] != tc.sub {
				t.Errorf("actor: %+v", l.Actor)
			}
			assertNoSecrets(t, lines, "SECRETCODE", "SECRETSTATE", "SECRETPROVIDER", params.Get("state"), f.nonce, f.challenge, "garage-admins")
		})
	}
}

func TestAuditOIDCCallbackIsSilentWhenOIDCIsOff(t *testing.T) {
	h := localHandler(t)
	stop := captureStdout(t)
	res := send(h, "GET", "/auth/oidc/callback?code=x&state=y", "", nil)
	if lines := stop(); res.Code != 404 || len(lines) != 0 {
		t.Fatalf("%d %v", res.Code, lines)
	}
}
