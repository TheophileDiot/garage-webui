package router

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"golang.org/x/crypto/bcrypt"
	"khairul169/garage-webui/utils"
)

const testAdminKey = "test-admin"

type garageCall struct {
	Method, URI, Authorization, Cookie, Body string
}

// fakeGarage stands in for the Garage admin and S3 APIs and records every request it receives.
type fakeGarage struct {
	*httptest.Server
	mu      sync.Mutex
	calls   []garageCall
	respond func(w http.ResponseWriter, r *http.Request)
}

func newFakeGarage(t *testing.T, respond func(w http.ResponseWriter, r *http.Request)) *fakeGarage {
	t.Helper()
	return newFakeGarageConn(t, respond, nil)
}

// newFakeGarageConn is newFakeGarage with a ConnState hook, set before the server accepts anything.
func newFakeGarageConn(t *testing.T, respond func(w http.ResponseWriter, r *http.Request), connState func(net.Conn, http.ConnState)) *fakeGarage {
	t.Helper()
	g := &fakeGarage{respond: respond}
	g.Server = httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewReader(body)) // the responder may read it too
		g.mu.Lock()
		g.calls = append(g.calls, garageCall{r.Method, r.RequestURI, r.Header.Get("Authorization"), r.Header.Get("Cookie"), string(body)})
		g.mu.Unlock()
		if g.respond != nil {
			g.respond(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
	}))
	g.Config.ConnState = connState
	g.Start()
	t.Cleanup(g.Close)
	t.Setenv("API_BASE_URL", g.URL)
	t.Setenv("S3_ENDPOINT_URL", g.URL)
	t.Setenv("API_ADMIN_KEY", testAdminKey)
	utils.InitCacheManager()
	return g
}

func (g *fakeGarage) seen() []garageCall {
	g.mu.Lock()
	defer g.mu.Unlock()
	return append([]garageCall(nil), g.calls...)
}

// send issues a same-origin API request, as the frontend does.
func send(h http.Handler, method, target, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("X-Requested-With", "garage-webui")
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)
	return res
}

// signedInOIDC returns a handler and the session cookie of the fake IdP's operator ("operator-1").
func signedInOIDC(t *testing.T) (http.Handler, *http.Cookie) {
	t.Helper()
	f := newOIDCFixture(t, "")
	cookie, params := f.start(t)
	login := request(f.handler, "GET", "/auth/oidc/callback?code=test&state="+params.Get("state"), cookie)
	if login.Code != http.StatusSeeOther {
		t.Fatalf("OIDC sign-in: %d %s", login.Code, login.Body.String())
	}
	return f.handler, login.Result().Cookies()[0]
}

// localAuth is the sign-in state for password login only (user "admin", password "correct-password").
func localAuth(t *testing.T) *Auth {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("PUBLIC_URL", "http://localhost:3909")
	t.Setenv("BASE_PATH", "")
	for _, key := range []string{"OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_ALLOWED_GROUPS"} {
		t.Setenv(key, "")
	}
	t.Setenv("AUTH_USER_PASS", "admin:"+string(hash))
	auth, err := NewAuth(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return auth
}

// localHandler serves the API with password login only (user "admin", password "correct-password").
func localHandler(t *testing.T) http.Handler {
	t.Helper()
	auth := localAuth(t)
	return utils.InitSessionManager().LoadAndSave(HandleApiRouter(auth))
}

// captureStdout redirects os.Stdout until the returned function is called, which restores it and
// returns the lines written meanwhile.
func captureStdout(t *testing.T) func() []string {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	orig := os.Stdout
	os.Stdout = w
	done := make(chan string)
	go func() {
		b, _ := io.ReadAll(r)
		done <- string(b)
	}()
	var once sync.Once
	var out string
	stop := func() {
		once.Do(func() {
			os.Stdout = orig
			w.Close()
			out = <-done
			r.Close()
		})
	}
	t.Cleanup(stop)
	return func() []string {
		stop()
		out := strings.TrimSuffix(out, "\n")
		if out == "" {
			return nil
		}
		return strings.Split(out, "\n")
	}
}
