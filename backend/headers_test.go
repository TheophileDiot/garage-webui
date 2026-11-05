package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func serve(publicURL string, inner http.HandlerFunc, method, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	securityHeaders(inner, publicURL).ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func ok(w http.ResponseWriter, r *http.Request) { w.Write([]byte("{}")) }

func TestEveryResponseCarriesTheGlobalHeaders(t *testing.T) {
	want := map[string]string{
		"X-Content-Type-Options":       "nosniff",
		"X-Frame-Options":              "DENY",
		"Referrer-Policy":              "same-origin",
		"Cross-Origin-Opener-Policy":   "same-origin",
		"Cross-Origin-Resource-Policy": "same-origin",
	}
	cases := map[string]http.HandlerFunc{
		"json": func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("{}"))
		},
		"error":    func(w http.ResponseWriter, r *http.Request) { http.Error(w, "nope", http.StatusForbidden) },
		"redirect": func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "/x/", http.StatusMovedPermanently) },
		"empty":    func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) },
	}
	for name, inner := range cases {
		rec := serve("", inner, "GET", "/api/x")
		for h, v := range want {
			if got := rec.Header().Get(h); got != v {
				t.Errorf("%s: %s = %q, want %q", name, h, got, v)
			}
		}
		pp := rec.Header().Get("Permissions-Policy")
		for _, f := range []string{"camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"} {
			if !strings.Contains(pp, f) {
				t.Errorf("%s: Permissions-Policy lacks %s: %q", name, f, pp)
			}
		}
	}
}

// Anything that is not application HTML or a stored object gets the locked-down default policy.
func TestAPIResponsesGetTheNoneCSP(t *testing.T) {
	rec := serve("", ok, "GET", "/api/config")
	if got := rec.Header().Get("Content-Security-Policy"); got != "default-src 'none'; frame-ancestors 'none'" {
		t.Fatalf("API CSP = %q", got)
	}
}

// A handler (the UI for HTML, the object route for stored files) can still set its own policy.
func TestHandlersOverrideTheDefaultCSP(t *testing.T) {
	rec := serve("", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "sandbox")
	}, "GET", "/")
	if got := rec.Header().Get("Content-Security-Policy"); got != "sandbox" {
		t.Fatalf("handler policy lost: %q", got)
	}
}

func TestHSTSOnlyForHTTPSPublicURL(t *testing.T) {
	for url, want := range map[string]string{
		"https://garage.example":      "max-age=31536000",
		"HTTPS://garage.example":      "max-age=31536000",
		"http://garage.example":       "",
		"http://localhost:3909":       "",
		"":                            "",
		"garage.example":              "",
		"ftp://https.example":         "",
		"http://garage.example/https": "",
	} {
		if got := serve(url, ok, "GET", "/").Header().Get("Strict-Transport-Security"); got != want {
			t.Errorf("PUBLIC_URL %q: HSTS %q, want %q", url, got, want)
		}
	}
}
