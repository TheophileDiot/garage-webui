package utils

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/alexedwards/scs/v2"
)

type SessionManager struct{ mgr *scs.SessionManager }

var Session *SessionManager

func InitSessionManager() *scs.SessionManager {
	mgr := scs.New()
	mgr.Lifetime = 8 * time.Hour
	mgr.Store = &revocationStore{Store: mgr.Store, lifetime: mgr.Lifetime}
	mgr.IdleTimeout = 30 * time.Minute
	mgr.Cookie.Name = "garage_webui_session"
	mgr.Cookie.Path = strings.TrimRight(os.Getenv("BASE_PATH"), "/") + "/"
	mgr.Cookie.HttpOnly = true
	mgr.Cookie.SameSite = http.SameSiteLaxMode
	mgr.Cookie.Secure = !strings.HasPrefix(os.Getenv("PUBLIC_URL"), "http://")
	Session = &SessionManager{mgr: mgr}
	return mgr
}

func (s *SessionManager) Get(r *http.Request, key string) interface{} {
	return s.mgr.Get(r.Context(), key)
}
func (s *SessionManager) Set(r *http.Request, key string, value interface{}) {
	s.mgr.Put(r.Context(), key, value)
}
func (s *SessionManager) Remove(r *http.Request, key string) { s.mgr.Remove(r.Context(), key) }
func (s *SessionManager) Destroy(r *http.Request) error      { return s.mgr.Destroy(r.Context()) }
func (s *SessionManager) Renew(r *http.Request) error        { return s.mgr.RenewToken(r.Context()) }

func (s *SessionManager) Authenticate(r *http.Request, name string, expiry time.Time) error {
	if err := s.Renew(r); err != nil {
		return err
	}
	if limit := time.Now().Add(8 * time.Hour); expiry.After(limit) {
		expiry = limit
	}
	s.mgr.SetDeadline(r.Context(), expiry)
	s.Set(r, "authenticated", true)
	s.Set(r, "display_name", name)
	s.Set(r, "expires_at", expiry.Unix())
	return nil
}

func (s *SessionManager) Authenticated(r *http.Request) bool {
	authenticated, _ := s.Get(r, "authenticated").(bool)
	expiry, _ := s.Get(r, "expires_at").(int64)
	return authenticated && (expiry == 0 || time.Now().Unix() < expiry)
}

var errSessionRevoked = errors.New("session revoked")

// Idle renewal must not resurrect a token deleted by a concurrent logout or login.
type revocationStore struct {
	scs.Store
	mu       sync.Mutex
	lifetime time.Duration
}

func (s *revocationStore) Commit(token string, data []byte, expiry time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, revoked, err := s.Store.Find("revoked:" + token); err != nil {
		return err
	} else if revoked {
		return errSessionRevoked
	}
	return s.Store.Commit(token, data, expiry)
}

func (s *revocationStore) Delete(token string) error {
	if token == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	// SCS tokens cannot contain ':'; the existing store also expires tombstones.
	if err := s.Store.Commit("revoked:"+token, nil, time.Now().Add(s.lifetime)); err != nil {
		return err
	}
	return s.Store.Delete(token)
}
