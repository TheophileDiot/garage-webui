package router

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

type auditLine struct {
	Time      string            `json:"time"`
	Event     string            `json:"event"`
	Actor     map[string]string `json:"actor"`
	Method    string            `json:"method"`
	Operation string            `json:"operation"`
	Target    map[string]string `json:"target"`
	Path      string            `json:"path"`
	Status    int               `json:"status"`
}

var auditKeys = map[string]bool{"time": true, "event": true, "actor": true, "method": true, "operation": true, "target": true, "path": true, "status": true}

// parseAudit fails the test unless every line is one well-formed JSON object with the known keys,
// a UTC RFC 3339 time and a status.
func parseAudit(t *testing.T, lines []string) []auditLine {
	t.Helper()
	out := make([]auditLine, 0, len(lines))
	for _, raw := range lines {
		var keys map[string]json.RawMessage
		if err := json.Unmarshal([]byte(raw), &keys); err != nil {
			t.Fatalf("audit line is not JSON: %q", raw)
		}
		for k := range keys {
			if !auditKeys[k] {
				t.Errorf("audit line has unexpected key %q: %s", k, raw)
			}
		}
		var l auditLine
		if err := json.Unmarshal([]byte(raw), &l); err != nil {
			t.Fatalf("audit line: %v: %s", err, raw)
		}
		at, err := time.Parse(time.RFC3339, l.Time)
		if err != nil || !strings.HasSuffix(l.Time, "Z") || time.Since(at) > time.Minute || time.Until(at) > time.Minute {
			t.Errorf("audit time %q is not a current UTC RFC 3339 time", l.Time)
		}
		if l.Status < 100 || l.Event == "" || l.Operation == "" || l.Method == "" || l.Actor["kind"] == "" {
			t.Errorf("audit line missing a field: %s", raw)
		}
		out = append(out, l)
	}
	return out
}

func auditGarage(t *testing.T) *fakeGarage {
	return newFakeGarage(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/v2/GetBucketInfo" && r.URL.Query().Get("globalAlias") != "":
			w.Write([]byte(`{"keys":[{"accessKeyId":"test-key","permissions":{"read":true,"write":true}}]}`))
		case r.URL.Path == "/v2/GetKeyInfo":
			w.Write([]byte(`{"accessKeyId":"test-key","secretAccessKey":"SECRETINRESPONSE"}`))
		default:
			w.Write([]byte(`{"ok":true}`))
		}
	})
}

func assertNoSecrets(t *testing.T, lines []string, extra ...string) {
	t.Helper()
	forbidden := append([]string{"SECRETINBODY", "SECRETINRESPONSE", testAdminKey, "test-secret", "refresh-1", "correct-password", "garage_webui_session", "Bearer", "not-for-browser"}, extra...)
	for _, line := range lines {
		for _, s := range forbidden {
			if strings.Contains(line, s) {
				t.Errorf("audit line leaks %q: %s", s, line)
			}
		}
	}
}

func TestAuditOneLinePerMutationAndSecretReveal(t *testing.T) {
	auditGarage(t)
	h, cookie := signedInOIDC(t)
	steps := []struct {
		method, target, body string
		event, operation     string // empty event: no line expected
		wantTarget           map[string]string
	}{
		{"GET", "/v2/ListKeys", "", "", "", nil},
		{"GET", "/v2/GetBucketInfo?id=b1", "", "", "", nil},
		{"GET", "/v2/GetKeyInfo?id=GKtest", "", "", "", nil},
		{"GET", "/v2/GetKeyInfo?id=GKtest&showSecretKey=false", "", "", "", nil},
		{"GET", "/v2/GetKeyInfo?id=GKtest&showSecretKey=true", "", "secret_reveal", "GetKeyInfo", map[string]string{"id": "GKtest"}},
		{"GET", "/v2/GetKeyInfo?search=mykey&showSecretKey=true", "", "secret_reveal", "GetKeyInfo", map[string]string{"search": "mykey"}},
		{"POST", "/v2/DeleteKey?id=GKtest", "", "mutation", "DeleteKey", map[string]string{"id": "GKtest"}},
		{"POST", "/v2/UpdateBucket?id=b1", `{"quotas":{"maxSize":1}}`, "mutation", "UpdateBucket", map[string]string{"id": "b1"}},
		{"POST", "/v2/CreateKey", `{"name":"x","secretAccessKey":"SECRETINBODY"}`, "mutation", "CreateKey", nil},
		{"POST", "/v2/CreateAdminToken", `{"name":"x"}`, "mutation", "unlisted", nil},
		{"GET", "/metrics", "", "", "", nil},
		{"GET", "/browse/test", "", "", "", nil},
		{"PUT", "/browse/test/dir/", "", "mutation", "PUT /browse/{bucket}/{key...}", map[string]string{"bucket": "test", "key": "dir/"}},
		{"DELETE", "/browse/test/dir/obj.txt", "", "mutation", "DELETE /browse/{bucket}/{key...}", map[string]string{"bucket": "test", "key": "dir/obj.txt"}},
		{"POST", "/auth/logout", "", "mutation", "POST /auth/logout", nil},
	}
	var results []int
	stop := captureStdout(t)
	for _, s := range steps {
		results = append(results, send(h, s.method, s.target, s.body, cookie).Code)
	}
	lines := stop()
	var expected []int
	for i, s := range steps {
		if s.event != "" {
			expected = append(expected, i)
		}
	}
	if len(lines) != len(expected) {
		t.Fatalf("got %d audit lines, want %d:\n%s", len(lines), len(expected), strings.Join(lines, "\n"))
	}
	got := parseAudit(t, lines)
	for n, i := range expected {
		s, l := steps[i], got[n]
		if l.Event != s.event || l.Operation != s.operation || l.Method != s.method || l.Status != results[i] {
			t.Errorf("step %d %s %s: line %+v, response status %d", i, s.method, s.target, l, results[i])
		}
		if l.Actor["kind"] != "oidc" || l.Actor["sub"] != "operator-1" || l.Actor["name"] != "Garage Operator" {
			t.Errorf("step %d actor: %v", i, l.Actor)
		}
		if fmt.Sprint(l.Target) != fmt.Sprint(s.wantTarget) && !(len(l.Target) == 0 && len(s.wantTarget) == 0) {
			t.Errorf("step %d target: got %v want %v", i, l.Target, s.wantTarget)
		}
		if (s.operation == "unlisted") != (l.Path != "") {
			t.Errorf("step %d: path %q set only for unlisted requests", i, l.Path)
		}
	}
	if got[0].Status != 200 || results[expected[0]] != 200 {
		t.Errorf("a reveal must record the real status: %+v", got[0])
	}
	unlisted := got[5]
	if unlisted.Status != http.StatusForbidden || unlisted.Path != "/v2/CreateAdminToken" {
		t.Errorf("denied request: %+v", unlisted)
	}
	assertNoSecrets(t, lines, cookie.Value)
}

func TestAuditRecordsUpstreamFailureStatus(t *testing.T) {
	newFakeGarage(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		w.Write([]byte(`{"message":"SECRETINRESPONSE"}`))
	})
	h, cookie := signedInOIDC(t)
	stop := captureStdout(t)
	res := send(h, "POST", "/v2/DeleteBucket?id=b9", "", cookie)
	lines := stop()
	l := parseAudit(t, lines)
	if res.Code != 409 || len(l) != 1 || l[0].Status != 409 || l[0].Operation != "DeleteBucket" || l[0].Target["id"] != "b9" {
		t.Fatalf("%d %v", res.Code, lines)
	}
	assertNoSecrets(t, lines)
}

func TestAuditIsOneLineUnderConcurrency(t *testing.T) {
	auditGarage(t)
	h, cookie := signedInOIDC(t)
	const n = 40
	stop := captureStdout(t)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			send(h, "POST", fmt.Sprintf("/v2/DeleteKey?id=GK%02d", i), "", cookie)
		}()
	}
	wg.Wait()
	lines := stop()
	if len(lines) != n {
		t.Fatalf("got %d lines, want %d", len(lines), n)
	}
	var ids []string
	for _, l := range parseAudit(t, lines) {
		ids = append(ids, l.Target["id"])
	}
	sort.Strings(ids)
	for i, id := range ids {
		if id != fmt.Sprintf("GK%02d", i) {
			t.Fatalf("ids: %v", ids)
		}
	}
}

func TestAuditNeutralisesHostileValues(t *testing.T) {
	auditGarage(t)
	h, cookie := signedInOIDC(t)
	stop := captureStdout(t)
	send(h, "POST", "/v2/DeleteKey?id=GK%0A%7B%22forged%22%3Atrue%7D%0D%0A", "", cookie)
	send(h, "POST", "/v2/CreateAdminToken%0Afake", "", cookie)
	send(h, "POST", "/v2/DeleteKey?id="+strings.Repeat("A", 100000), "", cookie)
	lines := stop()
	if len(lines) != 3 {
		t.Fatalf("hostile values split or dropped lines: %d\n%v", len(lines), lines)
	}
	for _, l := range parseAudit(t, lines) {
		if len(l.Target["id"]) > 2048 || len(l.Path) > 2048 {
			t.Errorf("unbounded value logged")
		}
	}
	for _, line := range lines {
		if len(line) > 8192 {
			t.Errorf("audit line is %d bytes", len(line))
		}
	}
}

func TestAuditLocalSessionActor(t *testing.T) {
	auditGarage(t)
	h := localHandler(t)
	stop := captureStdout(t)
	bad := send(h, "POST", "/auth/login", `{"username":"admin","password":"wrong-password"}`, nil)
	good := send(h, "POST", "/auth/login", `{"username":"admin","password":"correct-password"}`, nil)
	cookie := good.Result().Cookies()[0]
	del := send(h, "POST", "/v2/DeleteKey?id=GKlocal", "", cookie)
	lines := stop()
	if bad.Code != 401 || good.Code != 200 || del.Code != 200 {
		t.Fatalf("statuses %d %d %d", bad.Code, good.Code, del.Code)
	}
	got := parseAudit(t, lines)
	if len(got) != 3 {
		t.Fatalf("lines: %v", lines)
	}
	if got[0].Operation != "POST /auth/login" || got[0].Status != 401 || got[0].Actor["kind"] != "anonymous" || got[0].Actor["name"] != "" {
		t.Errorf("failed login: %+v", got[0])
	}
	local := map[string]string{"kind": "local", "sub": "admin", "name": "admin"}
	if got[1].Operation != "POST /auth/login" || got[1].Status != 200 || fmt.Sprint(got[1].Actor) != fmt.Sprint(local) {
		t.Errorf("login: %+v", got[1])
	}
	if got[2].Operation != "DeleteKey" || got[2].Target["id"] != "GKlocal" || fmt.Sprint(got[2].Actor) != fmt.Sprint(local) {
		t.Errorf("mutation: %+v", got[2])
	}
	assertNoSecrets(t, lines, "wrong-password", cookie.Value)
}

func TestAuditNothingForReadsOrAnonymousRequests(t *testing.T) {
	auditGarage(t)
	h, cookie := signedInOIDC(t)
	stop := captureStdout(t)
	send(h, "GET", "/v2/ListKeys", "", cookie)
	send(h, "GET", "/config", "", cookie)
	send(h, "GET", "/auth/status", "", nil)
	send(h, "POST", "/v2/DeleteKey?id=x", "", nil)
	send(h, "GET", "/v2/GetKeyInfo?id=x&showSecretKey=true", "", nil)
	if lines := stop(); len(lines) != 0 {
		t.Fatalf("unexpected audit lines: %v", lines)
	}
}
