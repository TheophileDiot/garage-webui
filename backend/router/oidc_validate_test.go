package router

import (
	"context"
	"strings"
	"testing"
)

// Both tables go through NewAuth, so they pin the startup rules whatever the helpers are called.
func TestPublicURLRules(t *testing.T) {
	for _, tc := range []struct {
		raw     string
		wantErr string // empty: accepted
	}{
		{"https://garage.example", ""},
		{"https://garage.example/", ""},
		{"http://localhost:3909", ""},
		{"http://127.0.0.1:3909", ""},
		{"https://garage.example:8443", ""},
		{"", "invalid PUBLIC_URL"},
		{"http://garage.example", "HTTPS is required"},
		{"https://user:pass@garage.example", "without credentials"},
		{"https://garage.example?x=1", "without credentials, query or fragment"},
		{"https://garage.example#frag", "without credentials, query or fragment"},
		{"https://garage.example/path", "only the origin"},
		{"https://GARAGE.example", "lowercase host"},
		{"https://garage.example:443", "omit the default port"},
		{"http://localhost:80", "omit the default port"},
	} {
		t.Run(tc.raw, func(t *testing.T) {
			localAuth(t)
			t.Setenv("PUBLIC_URL", tc.raw)
			got, err := NewAuth(context.Background())
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("rejected: %v", err)
				}
				if want := strings.TrimSuffix(tc.raw, "/"); got.origin != want {
					t.Fatalf("origin = %q, want %q", got.origin, want)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %v, want it to contain %q", err, tc.wantErr)
			}
		})
	}
}

func TestBasePathRules(t *testing.T) {
	for _, tc := range []struct {
		raw string
		ok  bool
	}{
		{"", true},
		{"/garage", true},
		{"/a/b", true},
		{"garage", false},
		{"/a/", false},
		{"/", false},
		{"/a//b", false},
		{"/a/../b", false},
		{"/a%2e", false},
		{"/a?x", false},
		{"/a#x", false},
		{`/a\b`, false},
	} {
		t.Run(tc.raw, func(t *testing.T) {
			localAuth(t)
			t.Setenv("BASE_PATH", tc.raw)
			got, err := NewAuth(context.Background())
			if tc.ok {
				if err != nil || got.basePath != tc.raw {
					t.Fatalf("rejected: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), "BASE_PATH") {
				t.Fatalf("accepted or wrong error: %v", err)
			}
		})
	}
}

func TestOIDCGroupMatching(t *testing.T) {
	a := &oidcAuth{groups: []string{"admins", "ops"}}
	for _, tc := range []struct {
		groups []string
		want   bool
	}{
		{[]string{"ops"}, true},
		{[]string{"x", "admins"}, true},
		{[]string{"Admins"}, false},
		{[]string{}, false},
		{nil, false},
	} {
		if got := a.allowed(tc.groups); got != tc.want {
			t.Errorf("allowed(%v) = %v", tc.groups, got)
		}
	}
}

func TestLocalCredentialsRequireUserAndBcryptHash(t *testing.T) {
	for _, tc := range []struct{ value, wantErr string }{
		{"", "anonymous access is disabled"},
		{"admin", "anonymous access is disabled"},
		{":hash", "anonymous access is disabled"},
		{"admin:not-bcrypt", "requires username:bcrypt_hash"},
	} {
		localAuth(t)
		t.Setenv("AUTH_USER_PASS", tc.value)
		if _, err := NewAuth(context.Background()); err == nil || !strings.Contains(err.Error(), tc.wantErr) {
			t.Errorf("%q: %v", tc.value, err)
		}
	}
}
