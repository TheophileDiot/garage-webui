package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	AuditMutation     = "mutation"
	AuditSecretReveal = "secret_reveal"

	maxAuditValue = 1024
)

// AuditRecord lets a handler say what the request was. Whatever it leaves empty is filled in from
// the route pattern the mux matched: the operation is the pattern, the targets are its wildcards.
type AuditRecord struct {
	Operation    string
	Target       map[string]string
	Path         string      // set for requests that matched no operation
	SecretReveal bool        // a read that returned a secret
	Always       bool        // audit whatever the method, for a GET that changes who is signed in
	Actor        utils.Actor // identity the handler established; replaces the session's when set
}

type auditKey struct{}

// Audit returns the request's record, or nil when the request is not audited.
func Audit(r *http.Request) *AuditRecord {
	rec, _ := r.Context().Value(auditKey{}).(*AuditRecord)
	return rec
}

// Auditor writes one JSON line per state-changing request and per secret reveal. A line holds the
// time, actor, method, operation, target IDs and response status: never a body, header, cookie,
// token or query string beyond the target IDs a handler names.
type Auditor struct {
	Out   func() io.Writer // looked up per line, so tests and os.Stdout swaps are honoured
	Actor func(*http.Request) utils.Actor
	Now   func() time.Time

	mu sync.Mutex
}

type auditLine struct {
	Time      string            `json:"time"`
	Event     string            `json:"event"`
	Actor     utils.Actor       `json:"actor"`
	Method    string            `json:"method"`
	Operation string            `json:"operation"`
	Target    map[string]string `json:"target,omitempty"`
	Path      string            `json:"path,omitempty"`
	Status    int               `json:"status"`
}

func (a *Auditor) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &AuditRecord{}
		// The mux sets Pattern and the path values on the request it routes, which is this copy.
		r = r.WithContext(context.WithValue(r.Context(), auditKey{}, rec))
		sw := &statusWriter{ResponseWriter: w}
		actor := a.Actor(r) // before the handler: logout destroys the session
		defer func() {
			p := recover()
			if p != nil && sw.status == 0 {
				sw.status = http.StatusInternalServerError
			}
			if actor.Kind == "" {
				actor = a.Actor(r) // sign-in creates it
			}
			a.emit(r, rec, actor, sw.statusOrOK())
			if p != nil {
				panic(p)
			}
		}()
		next.ServeHTTP(sw, r)
	})
}

func (a *Auditor) emit(r *http.Request, rec *AuditRecord, actor utils.Actor, status int) {
	switch {
	case rec.SecretReveal || rec.Always:
	case r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions:
		return
	}
	line := auditLine{
		Time:      a.Now().UTC().Format(time.RFC3339),
		Event:     AuditMutation,
		Actor:     actor,
		Method:    r.Method,
		Operation: rec.Operation,
		Target:    map[string]string{},
		Path:      clip(rec.Path),
		Status:    status,
	}
	if rec.SecretReveal {
		line.Event = AuditSecretReveal
	}
	if rec.Actor.Kind != "" {
		line.Actor = rec.Actor
	}
	if line.Actor.Kind == "" {
		line.Actor = utils.Actor{Kind: "anonymous"}
	}
	line.Actor.Subject, line.Actor.Name = clip(line.Actor.Subject), clip(line.Actor.Name)
	if line.Operation == "" {
		line.Operation = r.Pattern
	}
	if line.Operation == "" {
		line.Operation = "unmatched"
	}
	if rec.Target != nil {
		for k, v := range rec.Target {
			if v != "" {
				line.Target[k] = clip(v)
			}
		}
	} else {
		for _, name := range wildcards(r.Pattern) {
			if v := r.PathValue(name); v != "" {
				line.Target[name] = clip(v)
			}
		}
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if enc.Encode(line) != nil {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.Out().Write(buf.Bytes()) // one Write per line; a failing sink must not fail the request
}

// wildcards returns the names of the {name} and {name...} wildcards of a ServeMux pattern.
func wildcards(pattern string) []string {
	var names []string
	for {
		start := strings.IndexByte(pattern, '{')
		if start < 0 {
			return names
		}
		end := strings.IndexByte(pattern[start:], '}')
		if end < 0 {
			return names
		}
		if name := strings.TrimSuffix(pattern[start+1:start+end], "..."); name != "$" {
			names = append(names, name)
		}
		pattern = pattern[start+end+1:]
	}
}

// clip bounds an attacker-chosen value. The JSON encoder escapes control characters, so a value
// cannot add a line or a field.
func clip(s string) string {
	s = strings.ToValidUTF8(s, "�")
	if len(s) <= maxAuditValue {
		return s
	}
	s = s[:maxAuditValue]
	for !utf8.ValidString(s) { // do not keep half of a multi-byte character
		s = s[:len(s)-1]
	}
	return s
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	if w.status == 0 && (code >= 200 || code == http.StatusSwitchingProtocols) {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(p)
}

func (w *statusWriter) statusOrOK() int {
	if w.status == 0 {
		return http.StatusOK
	}
	return w.status
}

// Unwrap lets http.ResponseController reach the real writer (flushing, deadlines).
func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
