package router

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEmbeddedAllowListMatchesUIOperations(t *testing.T) {
	if got := len(allowedAdminOps.byRoute); got != len(uiOperations) {
		t.Fatalf("allow-list has %d operations, the UI uses %d", got, len(uiOperations))
	}
	for _, want := range uiOperations {
		op := allowedAdminOps.Match(httptest.NewRequest(want.method, want.path, nil))
		if op == nil || op.Path != want.path || op.Method != want.method || "/v2/"+op.Name != want.path {
			t.Errorf("%s %s: %+v", want.method, want.path, op)
		}
	}
}

func TestLoadAdminOpsRejectsBadEntries(t *testing.T) {
	entry := func(name, method, path string) string {
		return `{"operations":[{"name":"` + name + `","method":"` + method + `","path":"` + path + `"}]}`
	}
	cases := map[string]string{
		"not json":         `nope`,
		"no operations":    `{"operations":[]}`,
		"unknown method":   entry("A", "DELETE", "/v2/A"),
		"lowercase method": entry("A", "get", "/v2/A"),
		"path != name":     entry("A", "GET", "/v2/B"),
		"no v2 prefix":     entry("A", "GET", "/A"),
		"trailing slash":   entry("A", "GET", "/v2/A/"),
		"query in path":    entry("A", "GET", "/v2/A?x=1"),
		"dot segment":      entry("..", "GET", "/v2/.."),
		"empty name":       entry("", "GET", "/v2/"),
		"duplicate name":   `{"operations":[{"name":"A","method":"GET","path":"/v2/A"},{"name":"A","method":"POST","path":"/v2/A"}]}`,
	}
	for name, data := range cases {
		if _, err := loadAdminOps([]byte(data)); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	if _, err := loadAdminOps([]byte(entry("A", "GET", "/v2/A"))); err != nil {
		t.Errorf("valid entry rejected: %v", err)
	}
}

func TestMatchIsExact(t *testing.T) {
	cases := map[string]bool{
		"GET /v2/GetClusterHealth":     true,
		"POST /v2/GetClusterHealth":    false,
		"GET /v2/GetClusterHealth/":    false,
		"GET /v2/getclusterhealth":     false,
		"GET /v2/GetClusterHealth%2F":  false,
		"GET /v2/Get%43lusterHealth":   false,
		"GET /v2/%47etClusterHealth":   false,
		"GET /v2/GetClusterHealth%00":  false,
		"GET /v2/GetClusterHealth?x=1": true,
	}
	for in, want := range cases {
		method, target, _ := strings.Cut(in, " ")
		req := httptest.NewRequest(method, target, nil)
		if got := allowedAdminOps.Match(req) != nil; got != want {
			t.Errorf("%s: matched=%v want %v (Path %q RawPath %q)", in, got, want, req.URL.Path, req.URL.RawPath)
		}
	}
	// An opaque or absolute-form URL must not match either.
	req := httptest.NewRequest("GET", "/v2/GetClusterHealth", nil)
	req.URL.Opaque = "/v2/GetClusterHealth"
	if allowedAdminOps.Match(req) != nil {
		t.Error("opaque URL matched")
	}
}
