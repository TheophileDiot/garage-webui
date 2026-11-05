package utils

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
)

func TestRevokedSessionCannotBeRestoredByInflightRequest(t *testing.T) {
	for _, revoke := range []string{"logout", "renew"} {
		t.Run(revoke, func(t *testing.T) {
			mgr := InitSessionManager()
			seed, err := mgr.Load(context.Background(), "")
			if err != nil {
				t.Fatal(err)
			}
			mgr.Put(seed, "authenticated", true)
			token, _, err := mgr.Commit(seed)
			if err != nil {
				t.Fatal(err)
			}
			// Another request loaded the authenticated session before revocation.
			inflight, err := mgr.Load(context.Background(), token)
			if err != nil {
				t.Fatal(err)
			}
			revoking, err := mgr.Load(context.Background(), token)
			if err != nil {
				t.Fatal(err)
			}
			if revoke == "logout" {
				err = mgr.Destroy(revoking)
			} else {
				err = mgr.RenewToken(revoking)
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, _, err := mgr.Commit(inflight); err != errSessionRevoked {
				t.Fatal(err)
			}
			restored, err := mgr.Load(context.Background(), token)
			if err != nil {
				t.Fatal(err)
			}
			if mgr.GetBool(restored, "authenticated") {
				t.Fatal("in-flight idle renewal restored revoked authentication")
			}
		})
	}
}

func TestLateRequestDoesNotOverwriteLoginCookie(t *testing.T) {
	mgr := InitSessionManager()
	handler := mgr.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/seed":
			Session.Set(r, "seed", true)
		case "/login":
			if err := Session.Authenticate(r, Actor{Kind: "local", Subject: "operator", Name: "operator"}, time.Now().Add(time.Hour)); err != nil {
				t.Error(err)
			}
		}
	}))
	seed := httptest.NewRecorder()
	handler.ServeHTTP(seed, httptest.NewRequest("GET", "/seed", nil))
	oldCookie := seed.Result().Cookies()[0]
	loaded, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
	slow := mgr.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(loaded)
		<-release
	}))
	req := httptest.NewRequest("GET", "/slow", nil)
	req.AddCookie(oldCookie)
	late := httptest.NewRecorder()
	go func() { defer close(done); slow.ServeHTTP(late, req) }()
	<-loaded
	loginReq := httptest.NewRequest("POST", "/login", nil)
	loginReq.AddCookie(oldCookie)
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, loginReq)
	newCookie := login.Result().Cookies()[0]
	close(release)
	<-done
	if late.Code != http.StatusInternalServerError {
		t.Fatalf("revoked late response status: %d", late.Code)
	}
	if len(late.Result().Cookies()) != 0 {
		t.Fatal("late request overwrote rotated login cookie")
	}
	statusReq := httptest.NewRequest("GET", "/status", nil)
	statusReq.AddCookie(newCookie)
	status := httptest.NewRecorder()
	mgr.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !Session.Authenticated(r) {
			t.Fatal("fresh login is no longer authenticated")
		}
	})).ServeHTTP(status, statusReq)
}

type recordingStore struct {
	scs.Store
	expiry map[string]time.Time
}

func (s *recordingStore) Commit(token string, data []byte, expiry time.Time) error {
	s.expiry[token] = expiry
	return s.Store.Commit(token, data, expiry)
}

// The revocation tombstone must be dated by the session clock, so a moved clock cannot make it
// outlive or undershoot the sessions it guards.
func TestRevocationTombstoneUsesTheSessionClock(t *testing.T) {
	mgr := InitSessionManager()
	rs := mgr.Store.(*revocationStore)
	rec := &recordingStore{Store: rs.Store, expiry: map[string]time.Time{}}
	rs.Store = rec
	at := time.Date(2031, 1, 2, 3, 4, 5, 0, time.UTC)
	Session.Now = func() time.Time { return at }
	if err := rs.Delete("token"); err != nil {
		t.Fatal(err)
	}
	if got, want := rec.expiry["revoked:token"], at.Add(SessionLifetime); !got.Equal(want) {
		t.Fatalf("tombstone expires at %v, want %v", got, want)
	}
}
