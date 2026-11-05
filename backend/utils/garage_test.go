package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// fetch is the one place the tests name the client call, so a signature change is one edit.
func fetch(path string) ([]byte, error) { return Garage.Fetch(path) }

func fakeAdmin(t *testing.T, h http.HandlerFunc) {
	t.Helper()
	s := httptest.NewServer(h)
	t.Cleanup(s.Close)
	t.Setenv("API_BASE_URL", s.URL)
	t.Setenv("API_ADMIN_KEY", "admin-token")
}

func TestFetchReturnsTheBodyWithTheAdminToken(t *testing.T) {
	var auth, uri string
	fakeAdmin(t, func(w http.ResponseWriter, r *http.Request) {
		auth, uri = r.Header.Get("Authorization"), r.RequestURI
		w.Write([]byte(`{"ok":true}`))
	})
	body, err := fetch("/v2/ListBuckets?x=1")
	if err != nil || string(body) != `{"ok":true}` {
		t.Fatalf("%q %v", body, err)
	}
	if auth != "Bearer admin-token" || uri != "/v2/ListBuckets?x=1" {
		t.Fatalf("%q %q", auth, uri)
	}
}

func TestFetchErrorMessages(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
		want       string
	}{
		{"json message", `{"code":"X","message":"bucket not found"}`, 404, "bucket not found"},
		{"json without message", `{"code":"X"}`, 500, "unexpected status code: 500"},
		{"non-200 success code", `{"message":"created?"}`, 201, "created?"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fakeAdmin(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
				w.Write([]byte(tc.body))
			})
			if _, err := fetch("/x"); err == nil || err.Error() != tc.want {
				t.Fatalf("error = %v, want %q", err, tc.want)
			}
		})
	}
}

// D10: an error reply that is not JSON (a 502 page from a reverse proxy) is reported by its status.
func TestFetchNonJSONErrorBodyReportsTheStatus(t *testing.T) {
	for _, body := range []string{"<html>bad gateway</html>", "", "[1,2]", `"text"`} {
		fakeAdmin(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(502)
			w.Write([]byte(body))
		})
		if _, err := fetch("/x"); err == nil || err.Error() != "unexpected status code: 502" {
			t.Errorf("%q: %v", body, err)
		}
	}
}

// D9: a Garage that accepts the connection and never answers must not hang a call forever.
func TestFetchGivesUpOnASilentGarage(t *testing.T) {
	release := make(chan struct{})
	fakeAdmin(t, func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	})
	t.Cleanup(func() { close(release) })
	old := AdminTransport.ResponseHeaderTimeout
	AdminTransport.ResponseHeaderTimeout = 100 * time.Millisecond
	t.Cleanup(func() { AdminTransport.ResponseHeaderTimeout = old })
	done := make(chan error, 1)
	go func() { _, err := fetch("/v2/ListBuckets"); done <- err }()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("a silent Garage was reported as success")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("Fetch is still waiting for a Garage that never answers")
	}
}

func TestAdminTransportHasConnectionTimeouts(t *testing.T) {
	if AdminTransport.DialContext == nil || AdminTransport.TLSHandshakeTimeout <= 0 || AdminTransport.ResponseHeaderTimeout <= 0 {
		t.Fatalf("dial, TLS handshake and response header must each be bounded: dial %v, TLS %v, header %v", AdminTransport.DialContext != nil, AdminTransport.TLSHandshakeTimeout, AdminTransport.ResponseHeaderTimeout)
	}
}
