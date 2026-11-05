package middleware

import (
	"bytes"
	"io"
	"khairul169/garage-webui/utils"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func newTestAuditor(out *bytes.Buffer) *Auditor {
	return &Auditor{
		Out:   func() io.Writer { return out },
		Actor: func(*http.Request) utils.Actor { return utils.Actor{Kind: "local", Subject: "u", Name: "U"} },
		Now:   func() time.Time { return time.Date(2026, 11, 4, 12, 0, 0, 0, time.FixedZone("x", 3600)) },
	}
}

func TestWildcards(t *testing.T) {
	cases := map[string]string{
		"PUT /browse/{bucket}/{key...}": "bucket,key",
		"GET /a/{$}":                    "",
		"POST /auth/logout":             "",
		"/":                             "",
		"GET /x/{id}/y":                 "id",
		"GET /broken/{id":               "",
	}
	for pattern, want := range cases {
		if got := strings.Join(wildcards(pattern), ","); got != want {
			t.Errorf("%q: %q, want %q", pattern, got, want)
		}
	}
}

func TestClipKeepsValidUTF8(t *testing.T) {
	s := clip(strings.Repeat("é", 2000))
	if len(s) > maxAuditValue || !utf8.ValidString(s) || s == "" {
		t.Fatalf("len %d valid %v", len(s), utf8.ValidString(s))
	}
	if clip("a\xffb") != "a�b" {
		t.Fatal("invalid UTF-8 not replaced")
	}
}

func TestAuditTimeIsUTC(t *testing.T) {
	var out bytes.Buffer
	h := newTestAuditor(&out).Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("POST", "/x", nil))
	if !strings.Contains(out.String(), `"time":"2026-11-04T11:00:00Z"`) || !strings.Contains(out.String(), `"status":200`) {
		t.Fatal(out.String())
	}
}

func TestAuditRecordsAbortedHandlers(t *testing.T) {
	var out bytes.Buffer
	h := newTestAuditor(&out).Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { panic(http.ErrAbortHandler) }))
	func() {
		defer func() {
			if p := recover(); p != http.ErrAbortHandler {
				t.Fatalf("panic not propagated: %v", p)
			}
		}()
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("DELETE", "/x", nil))
	}()
	if !strings.Contains(out.String(), `"status":500`) || strings.Count(out.String(), "\n") != 1 {
		t.Fatalf("aborted request: %q", out.String())
	}
}

func TestAuditSkipsReadsAndIgnoresInformationalStatus(t *testing.T) {
	var out bytes.Buffer
	a := newTestAuditor(&out)
	read := a.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	for _, m := range []string{"GET", "HEAD", "OPTIONS"} {
		read.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(m, "/x", nil))
	}
	if out.Len() != 0 {
		t.Fatalf("reads audited: %q", out.String())
	}
	early := a.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusEarlyHints)
		w.WriteHeader(http.StatusAccepted)
	}))
	early.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("PUT", "/x", nil))
	if !strings.Contains(out.String(), `"status":202`) {
		t.Fatal(out.String())
	}
}

func TestAuditFailingSinkDoesNotFailRequest(t *testing.T) {
	a := newTestAuditor(nil)
	a.Out = func() io.Writer { return failingWriter{} }
	rec := httptest.NewRecorder()
	a.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })).ServeHTTP(rec, httptest.NewRequest("POST", "/x", nil))
	if rec.Code != 204 {
		t.Fatal(rec.Code)
	}
}

type failingWriter struct{}

func (failingWriter) Write([]byte) (int, error) { return 0, io.ErrClosedPipe }

func TestAuditAlwaysCoversAReadAndTheHandlersActor(t *testing.T) {
	var out bytes.Buffer
	a := newTestAuditor(&out)
	h := a.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := Audit(r)
		rec.Always, rec.Target = true, map[string]string{"outcome": "success"}
		rec.Actor = utils.Actor{Kind: "oidc", Subject: "s1", Name: "N"}
		w.WriteHeader(http.StatusSeeOther)
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/cb", nil))
	want := `"actor":{"kind":"oidc","sub":"s1","name":"N"},"method":"GET"`
	if !strings.Contains(out.String(), want) || !strings.Contains(out.String(), `"target":{"outcome":"success"}`) || !strings.Contains(out.String(), `"status":303`) {
		t.Fatalf("%q", out.String())
	}
}
