package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"khairul169/garage-webui/utils"
)

// The admin operations the UI calls today (Garage v2.5). Kept here by hand, independent of
// admin_ops.json, so a wrong edit of the data file cannot make its own test pass.
var uiOperations = []struct{ method, path, query string }{
	{"GET", "/v2/GetClusterHealth", ""},
	{"GET", "/v2/GetClusterStatus", ""},
	{"GET", "/v2/GetClusterLayout", ""},
	{"GET", "/v2/GetNodeInfo", "node=self"},
	{"POST", "/v2/ConnectClusterNodes", ""},
	{"POST", "/v2/UpdateClusterLayout", ""},
	{"POST", "/v2/ApplyClusterLayout", ""},
	{"POST", "/v2/RevertClusterLayout", ""},
	{"POST", "/v2/CreateBucket", ""},
	{"GET", "/v2/GetBucketInfo", "id=b1"},
	{"POST", "/v2/UpdateBucket", "id=b1"},
	{"POST", "/v2/DeleteBucket", "id=b1"},
	{"POST", "/v2/AddBucketAlias", ""},
	{"POST", "/v2/RemoveBucketAlias", ""},
	{"POST", "/v2/AllowBucketKey", ""},
	{"POST", "/v2/DenyBucketKey", ""},
	{"GET", "/v2/ListKeys", ""},
	{"GET", "/v2/GetKeyInfo", "id=GKtest"},
	{"POST", "/v2/CreateKey", ""},
	{"POST", "/v2/ImportKey", ""},
	{"POST", "/v2/DeleteKey", "id=GKtest"},
}

func TestProxyForwardsAllowedOperations(t *testing.T) {
	garage := newFakeGarage(t, nil)
	h, cookie := signedInOIDC(t)
	for _, op := range uiOperations {
		target := op.path
		if op.query != "" {
			target += "?" + op.query
		}
		body := ""
		if op.method == "POST" {
			body = `{"probe":"payload"}`
		}
		before := len(garage.seen())
		res := send(h, op.method, target, body, cookie)
		if res.Code != http.StatusOK || strings.TrimSpace(res.Body.String()) != `{"ok":true}` {
			t.Errorf("%s %s: %d %s", op.method, target, res.Code, res.Body.String())
			continue
		}
		calls := garage.seen()[before:]
		if len(calls) != 1 {
			t.Errorf("%s %s: Garage saw %d calls", op.method, target, len(calls))
			continue
		}
		c := calls[0]
		if c.Method != op.method || c.URI != target || c.Authorization != "Bearer "+testAdminKey || c.Cookie != "" || c.Body != body {
			t.Errorf("%s %s forwarded wrongly: %+v", op.method, target, c)
		}
	}
}

func TestProxyDropsClientCredentials(t *testing.T) {
	garage := newFakeGarage(t, nil)
	h, cookie := signedInOIDC(t)
	r := httptest.NewRequest("GET", "/v2/ListKeys", nil)
	r.Header.Set("Authorization", "Bearer attacker")
	r.AddCookie(cookie)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, r)
	calls := garage.seen()
	if res.Code != 200 || len(calls) != 1 {
		t.Fatalf("allowed read: %d, %d Garage calls", res.Code, len(calls))
	}
	if calls[0].Authorization != "Bearer "+testAdminKey || calls[0].Cookie != "" {
		t.Errorf("client credentials reached Garage: %+v", calls[0])
	}
}

func TestProxyRelaysGarageErrors(t *testing.T) {
	newFakeGarage(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"code":"NoSuchBucket","message":"no such bucket"}`))
	})
	h, cookie := signedInOIDC(t)
	res := send(h, "GET", "/v2/GetBucketInfo?id=nope", "", cookie)
	if res.Code != http.StatusNotFound || !strings.Contains(res.Body.String(), "NoSuchBucket") {
		t.Fatalf("Garage error not relayed: %d %s", res.Code, res.Body.String())
	}
}

func TestProxyRejectsUnlistedRequests(t *testing.T) {
	cases := []struct{ name, method, target string }{
		{"CreateAdminToken", "POST", "/v2/CreateAdminToken"},
		{"PurgeBlocks", "POST", "/v2/PurgeBlocks"},
		{"ClusterLayoutSkipDeadNodes", "POST", "/v2/ClusterLayoutSkipDeadNodes"},
		{"LaunchRepairOperation", "POST", "/v2/LaunchRepairOperation?node=*"},
		{"UpdateAdminToken", "POST", "/v2/UpdateAdminToken?id=x"},
		{"ListAdminTokens", "GET", "/v2/ListAdminTokens"},
		{"GetCurrentAdminTokenInfo", "GET", "/v2/GetCurrentAdminTokenInfo"},
		{"RetryBlockResync", "POST", "/v2/RetryBlockResync"},
		{"metrics", "GET", "/metrics"},
		{"health", "GET", "/health"},
		{"check domain", "GET", "/check?domain=example.com"},
		{"v1 path", "GET", "/v1/status"},
		{"unknown v2 operation", "GET", "/v2/NoSuchOperation"},
		{"root", "GET", "/"},
		{"dot segments", "GET", "/v2/../metrics"},
		{"dot segments into an allowed name", "GET", "/v2/x/../GetClusterHealth"},
		{"encoded dot segments", "GET", "/v2/%2e%2e/metrics"},
		{"encoded dot segments upper case", "GET", "/v2/%2E%2E/metrics"},
		{"encoded slash", "GET", "/v2%2FGetClusterHealth"},
		{"encoded letter", "GET", "/v2/Get%43lusterHealth"},
		{"encoded trailing slash", "GET", "/v2/GetClusterHealth%2F"},
		{"double slash prefix", "GET", "//v2/GetClusterHealth"},
		{"double slash inside", "GET", "/v2//GetClusterHealth"},
		{"mutation with double slash", "POST", "/v2//CreateAdminToken"},
		{"trailing slash", "GET", "/v2/GetClusterHealth/"},
		{"trailing slash on mutation", "POST", "/v2/DeleteKey/?id=x"},
		{"api prefix left in", "GET", "/api/v2/GetClusterHealth"},
		{"api prefix twice", "POST", "/api/v2/CreateAdminToken"},
		{"wrong case", "GET", "/v2/getclusterhealth"},
		{"path parameter", "GET", "/v2/GetClusterHealth;x=1"},
		{"suffix", "GET", "/v2/GetClusterHealthX"},
		{"nested", "GET", "/v2/GetClusterHealth/extra"},
		{"method mismatch POST on GET operation", "POST", "/v2/GetClusterHealth"},
		{"method mismatch GET on POST operation", "GET", "/v2/DeleteKey?id=x"},
		{"method mismatch PUT", "PUT", "/v2/GetClusterHealth"},
		{"method mismatch DELETE", "DELETE", "/v2/DeleteKey?id=x"},
		{"method mismatch PATCH", "PATCH", "/v2/UpdateBucket?id=x"},
		{"method mismatch HEAD", "HEAD", "/v2/GetClusterHealth"},
		{"method mismatch OPTIONS", "OPTIONS", "/v2/GetClusterHealth"},
		{"app route with other method", "POST", "/config"},
	}
	garage := newFakeGarage(t, nil)
	h, cookie := signedInOIDC(t)
	for _, c := range cases {
		res := send(h, c.method, c.target, "", cookie)
		if res.Code != http.StatusForbidden {
			t.Errorf("%s: %s %s returned %d, want 403", c.name, c.method, c.target, res.Code)
			continue
		}
		var body struct{ Message string }
		if c.method != "HEAD" && (json.Unmarshal(res.Body.Bytes(), &body) != nil || body.Message == "" || res.Header().Get("Content-Type") != "application/json") {
			t.Errorf("%s: 403 is not the JSON error shape: %q (%s)", c.name, res.Body.String(), res.Header().Get("Content-Type"))
		}
	}
	if calls := garage.seen(); len(calls) != 0 {
		t.Fatalf("forbidden requests reached Garage: %+v", calls)
	}
}

func TestProxyStillRequiresSession(t *testing.T) {
	garage := newFakeGarage(t, nil)
	h, _ := signedInOIDC(t)
	for _, target := range []string{"/v2/ListKeys", "/v2/CreateAdminToken", "/v2/../metrics"} {
		res := send(h, "GET", target, "", nil)
		if res.Code != http.StatusUnauthorized && res.Code != http.StatusForbidden {
			t.Errorf("anonymous %s: %d", target, res.Code)
		}
	}
	if res := send(h, "GET", "/v2/ListKeys", "", nil); res.Code != http.StatusUnauthorized {
		t.Errorf("anonymous allowed operation: %d", res.Code)
	}
	if calls := garage.seen(); len(calls) != 0 {
		t.Fatalf("anonymous requests reached Garage: %+v", calls)
	}
}

// Garage answers every admin call with its own CORS headers; the console is same-origin, so none
// of them may reach the browser. Everything else Garage sends still does.
func TestProxyDropsUpstreamCORSHeaders(t *testing.T) {
	newFakeGarage(t, func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Type", "application/json")
		h.Set("Access-Control-Allow-Origin", "*")
		h.Set("Access-Control-Allow-Credentials", "true")
		h.Set("Access-Control-Expose-Headers", "X-Garage-Probe")
		h.Set("X-Garage-Probe", "kept")
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"ok":true}`))
	})
	h, cookie := signedInOIDC(t)
	res := send(h, "GET", "/v2/GetClusterHealth", "", cookie)
	if res.Code != http.StatusCreated || strings.TrimSpace(res.Body.String()) != `{"ok":true}` {
		t.Fatalf("status and body must pass through: %d %s", res.Code, res.Body.String())
	}
	for name := range res.Header() {
		if strings.HasPrefix(strings.ToLower(name), "access-control-") {
			t.Errorf("upstream %s reached the browser: %q", name, res.Header().Get(name))
		}
	}
	if got := res.Header().Get("X-Garage-Probe"); got != "kept" {
		t.Errorf("a non-CORS upstream header must pass through, got %q", got)
	}
}

// D9: the admin proxy gives up on a Garage that never answers.
func TestProxyGivesUpOnASilentGarage(t *testing.T) {
	release := make(chan struct{})
	newFakeGarage(t, func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	})
	t.Cleanup(func() { close(release) })
	old := utils.AdminTransport.ResponseHeaderTimeout
	utils.AdminTransport.ResponseHeaderTimeout = 100 * time.Millisecond
	t.Cleanup(func() { utils.AdminTransport.ResponseHeaderTimeout = old })
	done := make(chan int, 1)
	go func() {
		res := httptest.NewRecorder()
		ProxyHandler(res, httptest.NewRequest("GET", "/v2/GetClusterHealth", nil))
		done <- res.Code
	}()
	select {
	case code := <-done:
		if code != http.StatusBadGateway {
			t.Fatalf("status %d", code)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("the proxy is still waiting for a Garage that never answers")
	}
}
