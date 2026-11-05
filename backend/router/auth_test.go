package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"khairul169/garage-webui/middleware"
	"khairul169/garage-webui/schema"
	"khairul169/garage-webui/utils"
)

func TestMissingAuthDeniesAPI(t *testing.T) {
	t.Setenv("AUTH_USER_PASS", "")
	mgr := utils.InitSessionManager()
	handler := mgr.LoadAndSave(middleware.AuthMiddleware(utils.Session.Authenticated, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })))
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest("GET", "/config", nil))
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("unconfigured auth allowed API: %d", res.Code)
	}
}

func TestStatusDoesNotInventAuthentication(t *testing.T) {
	res := send(localHandler(t), "GET", "/auth/status", "", nil)
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["authenticated"] != false || body["local"] != true || body["oidc"] != false {
		t.Fatalf("anonymous status: %s", res.Body.String())
	}
}

func TestConfigRedactsSecrets(t *testing.T) {
	original := utils.Garage.Config
	t.Cleanup(func() { utils.Garage.Config = original })
	utils.Garage.Config = schema.Config{RPCSecret: "secret-rpc", Admin: schema.Admin{AdminToken: "secret-admin", MetricsToken: "secret-metrics"}}
	res := httptest.NewRecorder()
	(&Config{}).GetAll(res, httptest.NewRequest("GET", "/config", nil))
	for _, secret := range []string{"secret-rpc", "secret-admin", "secret-metrics", "rpc_secret", "admin_token", "metrics_token"} {
		if strings.Contains(res.Body.String(), secret) {
			t.Errorf("config disclosed %s", secret)
		}
	}
}

func TestLocalLoginRotatesSession(t *testing.T) {
	auth := localAuth(t)
	mgr := utils.InitSessionManager()
	seed := httptest.NewRecorder()
	mgr.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { utils.Session.Set(r, "seed", "before-login") })).ServeHTTP(seed, httptest.NewRequest("GET", "/seed", nil))
	before := seed.Result().Cookies()[0]
	req := httptest.NewRequest("POST", "/auth/login", strings.NewReader(`{"username":"admin","password":"correct-password"}`))
	req.AddCookie(before)
	res := httptest.NewRecorder()
	mgr.LoadAndSave(http.HandlerFunc(auth.Login)).ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("login: %d %s", res.Code, res.Body.String())
	}
	cookies := res.Result().Cookies()
	if len(cookies) == 0 || cookies[0].Value == before.Value {
		t.Fatal("login retained pre-authentication session token")
	}
}

func TestLogoutDestroysCookie(t *testing.T) {
	mgr := utils.InitSessionManager()
	seed := httptest.NewRecorder()
	mgr.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { utils.Session.Set(r, "authenticated", true) })).ServeHTTP(seed, httptest.NewRequest("GET", "/seed", nil))
	req := httptest.NewRequest("POST", "/auth/logout", nil)
	req.AddCookie(seed.Result().Cookies()[0])
	res := httptest.NewRecorder()
	mgr.LoadAndSave(http.HandlerFunc((&Auth{}).Logout)).ServeHTTP(res, req)
	cookies := res.Result().Cookies()
	if len(cookies) == 0 || cookies[0].MaxAge >= 0 {
		t.Fatal("logout retained session cookie")
	}
}

func TestLocalLoginChecksUserAndPassword(t *testing.T) {
	h := localHandler(t)
	for _, body := range []string{
		`{"username":"admin","password":"wrong"}`,
		`{"username":"other","password":"correct-password"}`,
		`{"username":"","password":""}`,
	} {
		if res := send(h, "POST", "/auth/login", body, nil); res.Code != http.StatusUnauthorized {
			t.Errorf("%s: %d", body, res.Code)
		}
	}
	if res := send(h, "POST", "/auth/login", `{"username":"admin","password":"correct-password"}`, nil); res.Code != http.StatusOK {
		t.Fatalf("valid login: %d %s", res.Code, res.Body.String())
	}
}
