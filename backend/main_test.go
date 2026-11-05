package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
	"khairul169/garage-webui/router"
	"khairul169/garage-webui/utils"
)

// TestMainProcess is the child of the tests below: it runs main() inside the test binary, so the
// real startup, healthcheck and shutdown paths are exercised. It does nothing on its own.
func TestMainProcess(t *testing.T) {
	if os.Getenv("GARAGE_WEBUI_TEST_CHILD") != "1" {
		t.Skip("helper process")
	}
	os.Args = []string{"garage-webui"}
	if arg := os.Getenv("GARAGE_WEBUI_TEST_ARG"); arg != "" {
		os.Args = append(os.Args, arg)
	}
	main()
}

// child starts main() with exactly the given environment (and no .env file in its directory).
func child(t *testing.T, arg string, env ...string) (*exec.Cmd, *bytes.Buffer) {
	t.Helper()
	cmd := exec.Command(os.Args[0], "-test.run=^TestMainProcess$")
	cmd.Dir = t.TempDir()
	cmd.Env = append([]string{"GARAGE_WEBUI_TEST_CHILD=1", "GARAGE_WEBUI_TEST_ARG=" + arg, "PATH=" + os.Getenv("PATH")}, env...)
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	return cmd, &out
}

func exitCode(t *testing.T, cmd *exec.Cmd) int {
	t.Helper()
	err := cmd.Run()
	var exit *exec.ExitError
	switch {
	case err == nil:
		return 0
	case errors.As(err, &exit):
		return exit.ExitCode()
	}
	t.Fatal(err)
	return -1
}

// listen serves handler on host:0 and returns the port.
func listen(t *testing.T, host string, handler http.Handler) string {
	t.Helper()
	l, err := net.Listen("tcp", host+":0")
	if err != nil {
		t.Skipf("cannot listen on %s: %v", host, err)
	}
	srv := &http.Server{Handler: handler}
	go srv.Serve(l)
	t.Cleanup(func() { srv.Close() })
	_, port, _ := net.SplitHostPort(l.Addr().String())
	return port
}

func healthz(status int, basePath string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+basePath+"/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(status) })
	return mux
}

func TestHealthcheckCommand(t *testing.T) {
	for _, tc := range []struct {
		name     string
		listenOn string
		status   int
		basePath string
		host     string // HOST of the healthcheck process
		wantExit int
	}{
		{"healthy", "127.0.0.1", 204, "", "", 0},
		{"healthy under a base path", "127.0.0.1", 204, "/garage", "", 0},
		{"unhealthy", "127.0.0.1", 500, "", "", 1},
		{"wrong status", "127.0.0.1", 200, "", "", 1},
		{"unspecified HOST dials loopback", "127.0.0.1", 204, "", "0.0.0.0", 0},
		// D11: the server listens on HOST, which is not 127.0.0.1.
		{"concrete HOST is the address dialled", "127.0.0.2", 204, "", "127.0.0.2", 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			port := listen(t, tc.listenOn, healthz(tc.status, tc.basePath))
			env := []string{"PORT=" + port, "BASE_PATH=" + tc.basePath}
			if tc.host != "" {
				env = append(env, "HOST="+tc.host)
			}
			cmd, out := child(t, "healthcheck", env...)
			if got := exitCode(t, cmd); got != tc.wantExit {
				t.Fatalf("exit %d, want %d\n%s", got, tc.wantExit, out)
			}
		})
	}
	t.Run("nothing listening", func(t *testing.T) {
		l, _ := net.Listen("tcp", "127.0.0.1:0")
		_, port, _ := net.SplitHostPort(l.Addr().String())
		l.Close()
		cmd, out := child(t, "healthcheck", "PORT="+port)
		if got := exitCode(t, cmd); got != 1 {
			t.Fatalf("exit %d\n%s", got, out)
		}
	})
}

func TestStartupFailsClosed(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	base := []string{"PUBLIC_URL=http://localhost:3909", "AUTH_USER_PASS=admin:" + string(hash), "API_BASE_URL=http://127.0.0.1:1", "API_ADMIN_KEY=x", "PORT=0"}
	for _, tc := range []struct {
		name string
		env  []string
		want string
	}{
		{"no authentication", []string{"PUBLIC_URL=http://localhost:3909", "API_BASE_URL=http://127.0.0.1:1", "API_ADMIN_KEY=x"}, "anonymous access is disabled"},
		{"no Garage settings", []string{"PUBLIC_URL=http://localhost:3909", "AUTH_USER_PASS=admin:" + string(hash)}, "Garage configuration unavailable"},
		{"invalid upload limit", append([]string{"UPLOAD_MAX_BYTES=lots"}, base...), "UPLOAD_MAX_BYTES must be a positive integer"},
		{"zero upload limit", append([]string{"UPLOAD_MAX_BYTES=0"}, base...), "UPLOAD_MAX_BYTES must be a positive integer"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cmd, out := child(t, "", tc.env...)
			if got := exitCode(t, cmd); got == 0 || !strings.Contains(out.String(), tc.want) {
				t.Fatalf("exit %d, want a failure mentioning %q\n%s", got, tc.want, out)
			}
		})
	}
}

// The wiring of main: routes under the base path, the global headers, the session layer and a clean shutdown.
func TestServerWiring(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	l, _ := net.Listen("tcp", "127.0.0.1:0")
	_, port, _ := net.SplitHostPort(l.Addr().String())
	l.Close()
	origin := "http://127.0.0.1:" + port
	cmd, out := child(t, "", "PORT="+port, "HOST=127.0.0.1", "PUBLIC_URL="+origin, "BASE_PATH=/garage",
		"AUTH_USER_PASS=admin:"+string(hash), "API_BASE_URL=http://127.0.0.1:1", "API_ADMIN_KEY=x")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()
	t.Cleanup(func() { cmd.Process.Kill() })

	client := &http.Client{Timeout: 2 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	do := func(method, path, body string) *http.Response {
		t.Helper()
		req, _ := http.NewRequest(method, origin+path, strings.NewReader(body))
		req.Header.Set("X-Requested-With", "garage-webui")
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("%s %s: %v\n%s", method, path, err, out)
		}
		res.Body.Close()
		return res
	}
	deadline := time.Now().Add(15 * time.Second)
	for {
		if res, err := client.Get(origin + "/garage/healthz"); err == nil {
			res.Body.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("server did not start\n%s", out)
		}
		time.Sleep(50 * time.Millisecond)
	}

	if res := do("GET", "/garage/healthz", ""); res.StatusCode != 204 || res.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("healthz: %d %v", res.StatusCode, res.Header)
	}
	if res := do("GET", "/garage/api/auth/status", ""); res.StatusCode != 200 || res.Header.Get("Content-Security-Policy") != "default-src 'none'; frame-ancestors 'none'" || res.Header.Get("X-Frame-Options") != "DENY" {
		t.Errorf("status: %d %v", res.StatusCode, res.Header)
	}
	if res := do("GET", "/elsewhere", ""); res.StatusCode != http.StatusMovedPermanently || res.Header.Get("Location") != "/garage/" || res.Header.Get("X-Frame-Options") != "DENY" {
		t.Errorf("redirect: %d %v", res.StatusCode, res.Header)
	}
	if res := do("GET", "/garage/api/config", ""); res.StatusCode != http.StatusUnauthorized {
		t.Errorf("an API route without a session: %d", res.StatusCode)
	}
	if res := do("POST", "/garage/api/auth/login", `{"username":"admin","password":"wrong"}`); res.StatusCode != http.StatusUnauthorized {
		t.Errorf("wrong password: %d", res.StatusCode)
	}
	login := do("POST", "/garage/api/auth/login", `{"username":"admin","password":"correct-password"}`)
	cookies := login.Cookies()
	if login.StatusCode != 200 || len(cookies) != 1 || cookies[0].Name != "garage_webui_session" || cookies[0].Path != "/garage/" || !cookies[0].HttpOnly {
		t.Errorf("login: %d %v", login.StatusCode, cookies)
	}

	cmd.Process.Signal(syscall.SIGTERM)
	select {
	case err := <-exited:
		if err != nil {
			t.Errorf("shutdown: %v\n%s", err, out)
		}
	case <-time.After(10 * time.Second):
		t.Fatalf("no shutdown after SIGTERM\n%s", out)
	}
	if !strings.Contains(out.String(), fmt.Sprintf("Starting Garage WebUI on 127.0.0.1:%s", port)) {
		t.Errorf("startup line missing\n%s", out)
	}
}

// serverFixture serves the handler main builds (health probe, API, UI, base-path redirect, headers,
// sessions) in front of a fake Garage, signed in as "admin". seen() counts what reached Garage.
func serverFixture(t *testing.T, basePath string) (origin string, client *http.Client, cookie *http.Cookie, seen func() int) {
	t.Helper()
	var mu sync.Mutex
	reached := 0
	garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		reached++
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy"}`))
	}))
	t.Cleanup(garage.Close)
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	t.Setenv("PUBLIC_URL", "http://localhost:3909")
	t.Setenv("BASE_PATH", basePath)
	t.Setenv("AUTH_USER_PASS", "admin:"+string(hash))
	t.Setenv("API_BASE_URL", garage.URL)
	t.Setenv("API_ADMIN_KEY", "x")
	for _, key := range []string{"OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_ALLOWED_GROUPS"} {
		t.Setenv(key, "")
	}
	auth, err := router.NewAuth(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(newHandler(auth, utils.InitSessionManager(), basePath, "http://localhost:3909"))
	t.Cleanup(srv.Close)
	client = &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	seen = func() int { mu.Lock(); defer mu.Unlock(); return reached }

	req, _ := http.NewRequest("POST", srv.URL+basePath+"/api/auth/login", strings.NewReader(`{"username":"admin","password":"correct-password"}`))
	req.Header.Set("X-Requested-With", "garage-webui")
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 || len(res.Cookies()) != 1 {
		t.Fatalf("login: %d", res.StatusCode)
	}
	return srv.URL, client, res.Cookies()[0], seen
}

// The outer mux must not clean an API path before the API handler sees it: an unclean path is a
// probe of the admin proxy and gets the same 403, and audit line, as any unlisted operation.
func TestUncleanAPIPathsAreRejectedNotRedirected(t *testing.T) {
	for _, basePath := range []string{"", "/garage"} {
		t.Run("base"+basePath, func(t *testing.T) {
			origin, client, cookie, seen := serverFixture(t, basePath)
			get := func(method, path string) *http.Response {
				t.Helper()
				req, err := http.NewRequest(method, origin+path, nil)
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("X-Requested-With", "garage-webui")
				req.AddCookie(cookie)
				res, err := client.Do(req)
				if err != nil {
					t.Fatalf("%s: %v", path, err)
				}
				res.Body.Close()
				return res
			}
			api := basePath + "/api"

			// The audit line goes to stdout; each rejected POST probe must leave exactly one 403 line.
			r, w, _ := os.Pipe()
			stdout := os.Stdout
			os.Stdout = w
			defer func() { os.Stdout = stdout }()
			if res := get("GET", api+"/v2/GetClusterHealth"); res.StatusCode != 200 {
				t.Fatalf("clean allowed operation: %d", res.StatusCode)
			}
			probes := 0
			for _, p := range []string{
				"/v2//GetClusterHealth", "//v2/GetClusterHealth", "/v2/./GetClusterHealth", "/v2/../v2/GetClusterHealth",
				"/v2/x/../GetClusterHealth", "/./v2/GetClusterHealth", "/../v2/GetClusterHealth",
				"/v2/%2e/GetClusterHealth", "/v2/%2e%2e/v2/GetClusterHealth", "/v2/%2E%2E/v2/GetClusterHealth",
				"/v2/%2fGetClusterHealth", "/v2/.%2e/v2/GetClusterHealth", "/v2/%2e./v2/GetClusterHealth",
				"/v2//GetClusterHealth?x=1", "/v2/./GetClusterHealth/", "/v2/..",
			} {
				probes++ // one audited POST each; a GET is not audited
				before := seen()
				// A POST too: the audit log holds mutations only, and a probe may use any method.
				if res := get("POST", api+p); res.StatusCode != http.StatusForbidden || res.Header.Get("Location") != "" {
					t.Errorf("POST %s: %d, Location %q; want 403 and no redirect", api+p, res.StatusCode, res.Header.Get("Location"))
				}
				res := get("GET", api+p)
				if res.StatusCode != http.StatusForbidden || res.Header.Get("Location") != "" {
					t.Errorf("%s: %d, Location %q; want 403 and no redirect", api+p, res.StatusCode, res.Header.Get("Location"))
				}
				if seen() != before {
					t.Errorf("%s reached Garage", api+p)
				}
			}
			os.Stdout = stdout
			w.Close()
			logged, _ := io.ReadAll(r)
			denied := 0
			for _, line := range strings.Split(strings.TrimSpace(string(logged)), "\n") {
				if strings.Contains(line, `"status":403`) {
					denied++
				}
			}
			if denied != probes {
				t.Errorf("%d probes but %d audited 403 lines:\n%s", probes, denied, logged)
			}
		})
	}
}
