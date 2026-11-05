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

// SessionLifetime is the absolute session cap.
const SessionLifetime = 8 * time.Hour

type SessionManager struct {
	mgr *scs.SessionManager
	Now func() time.Time // replaceable so tests can move the clock
}

var Session *SessionManager

func InitSessionManager() *scs.SessionManager {
	mgr := scs.New()
	mgr.Lifetime = SessionLifetime
	session := &SessionManager{mgr: mgr, Now: time.Now}
	mgr.Store = &revocationStore{Store: mgr.Store, lifetime: mgr.Lifetime, now: func() time.Time { return session.Now() }}
	mgr.IdleTimeout = 30 * time.Minute
	mgr.Cookie.Name = "garage_webui_session"
	mgr.Cookie.Path = strings.TrimRight(os.Getenv("BASE_PATH"), "/") + "/"
	mgr.Cookie.HttpOnly = true
	mgr.Cookie.SameSite = http.SameSiteLaxMode
	mgr.Cookie.Secure = !strings.HasPrefix(os.Getenv("PUBLIC_URL"), "http://")
	Session = session
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

// Actor is who a session belongs to: a stable identity for the audit log, set once at sign-in.
type Actor struct {
	Kind    string `json:"kind"`          // "oidc" or "local"; "anonymous" when nobody is signed in
	Subject string `json:"sub,omitempty"` // OIDC subject, or the local username
	Name    string `json:"name,omitempty"`
}

func (s *SessionManager) Authenticate(r *http.Request, actor Actor, expiry time.Time) error {
	if err := s.Renew(r); err != nil {
		return err
	}
	if limit := s.Now().Add(SessionLifetime); expiry.After(limit) {
		expiry = limit
	}
	s.mgr.SetDeadline(r.Context(), expiry)
	s.Set(r, "authenticated", true)
	s.Set(r, "display_name", actor.Name)
	s.Set(r, "actor_kind", actor.Kind)
	s.Set(r, "actor_sub", actor.Subject)
	s.Set(r, "expires_at", expiry.Unix())
	return nil
}

// Actor returns the signed-in identity, or the zero value without a session.
func (s *SessionManager) Actor(r *http.Request) Actor {
	if authenticated, _ := s.Get(r, "authenticated").(bool); !authenticated {
		return Actor{}
	}
	kind, _ := s.Get(r, "actor_kind").(string)
	sub, _ := s.Get(r, "actor_sub").(string)
	name, _ := s.Get(r, "display_name").(string)
	return Actor{Kind: kind, Subject: sub, Name: name}
}

func (s *SessionManager) Authenticated(r *http.Request) bool {
	authenticated, _ := s.Get(r, "authenticated").(bool)
	expiry, _ := s.Get(r, "expires_at").(int64)
	return authenticated && (expiry == 0 || s.Now().Unix() < expiry)
}

var errSessionRevoked = errors.New("session revoked")

// Idle renewal must not resurrect a token deleted by a concurrent logout or login.
type revocationStore struct {
	scs.Store
	mu       sync.Mutex
	lifetime time.Duration
	now      func() time.Time // the session clock, so tombstones and sessions share one timeline
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
	if err := s.Store.Commit("revoked:"+token, nil, s.now().Add(s.lifetime)); err != nil {
		return err
	}
	return s.Store.Delete(token)
}
