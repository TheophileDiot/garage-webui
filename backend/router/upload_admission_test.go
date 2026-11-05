package router

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// withUploadLimit sets the upload cap (and so the budget) for one test and restores the old one.
func withUploadLimit(t *testing.T, limit int64) {
	t.Helper()
	old := maxUploadBytes
	setUploadLimit(limit)
	t.Cleanup(func() { setUploadLimit(old) })
}

// gatedBody serves a multipart body but stops after its first half until gate is closed: the
// handler has then been admitted (it reads the body only after admission) and is still in flight.
type gatedBody struct {
	data    []byte
	pos     int
	started chan struct{}
	gate    chan struct{}
	opened  bool
	cutAt   bool // when set, the body ends in an error once the gate opens: the connection dropped
}

func newGatedBody(data []byte) *gatedBody {
	return &gatedBody{data: data, started: make(chan struct{}), gate: make(chan struct{})}
}

func (g *gatedBody) Read(p []byte) (int, error) {
	if g.pos == 0 {
		close(g.started)
	}
	if g.pos >= len(g.data)/2 && !g.opened {
		<-g.gate
		g.opened = true
		if g.cutAt {
			return 0, io.ErrUnexpectedEOF
		}
	}
	if g.pos >= len(g.data) {
		return 0, io.EOF
	}
	end := len(g.data)
	if !g.opened {
		end = len(g.data) / 2
	}
	n := copy(p, g.data[g.pos:end])
	g.pos += n
	return n, nil
}

type uploadCall struct {
	body *gatedBody
	done chan *httptest.ResponseRecorder
}

// startUpload runs PutObject in the background. length < 0 sends no Content-Length.
func startUpload(t *testing.T, key string, size int, length int64, ctx context.Context) *uploadCall {
	buf, contentType := multipartFile(t, key, bytes.Repeat([]byte("x"), size))
	body := newGatedBody(buf.Bytes())
	if length == 0 {
		length = int64(buf.Len())
	}
	req := httptest.NewRequest("PUT", "/browse/test/"+key, body).WithContext(ctx)
	req.ContentLength = length
	req.Header.Set("Content-Type", contentType)
	req.SetPathValue("bucket", "test")
	req.SetPathValue("key", key)
	c := &uploadCall{body: body, done: make(chan *httptest.ResponseRecorder, 1)}
	go func() {
		res := httptest.NewRecorder()
		(&Browse{}).PutObject(res, req)
		c.done <- res
	}()
	return c
}

func (c *uploadCall) admitted(within time.Duration) bool {
	select {
	case <-c.body.started:
		return true
	case <-time.After(within):
		return false
	}
}

func (c *uploadCall) finish(t *testing.T) *httptest.ResponseRecorder {
	t.Helper()
	select {
	case <-c.body.gate:
	default:
		close(c.body.gate)
	}
	select {
	case res := <-c.done:
		return res
	case <-time.After(5 * time.Second):
		t.Fatal("the upload did not finish")
		return nil
	}
}

// requireBudgetFree proves every charge is back: an upload with no length is charged the whole cap
// and is admitted at once only when nothing else is in flight.
func requireBudgetFree(t *testing.T) {
	t.Helper()
	probe := startUpload(t, "probe.bin", 10, -1, context.Background())
	if !probe.admitted(2 * time.Second) {
		probe.finish(t)
		t.Fatal("the budget was not released")
	}
	if res := probe.finish(t); res.Code != 200 {
		t.Fatalf("probe: %d %s", res.Code, res.Body.String())
	}
}

func TestUploadsShareOneBudget(t *testing.T) {
	withUploadLimit(t, 4096)
	g := newS3Garage(t)

	first := startUpload(t, "a.bin", 2500, 0, context.Background())
	if !first.admitted(2 * time.Second) {
		t.Fatal("the first upload was not admitted")
	}
	second := startUpload(t, "b.bin", 2500, 0, context.Background())
	if second.admitted(300 * time.Millisecond) {
		t.Fatal("a second 2500-byte upload was admitted while the first held 2500 of 4096")
	}
	if res := first.finish(t); res.Code != 200 {
		t.Fatalf("first: %d %s", res.Code, res.Body.String())
	}
	if !second.admitted(2 * time.Second) {
		t.Fatal("the waiting upload was not admitted after the first finished")
	}
	if res := second.finish(t); res.Code != 200 || !g.has("a.bin") || !g.has("b.bin") {
		t.Fatalf("second: %d %s", res.Code, res.Body.String())
	}
	requireBudgetFree(t)
}

func TestUploadWithoutLengthIsChargedTheWholeCap(t *testing.T) {
	withUploadLimit(t, 4096)
	newS3Garage(t)

	unsized := startUpload(t, "a.bin", 100, -1, context.Background())
	if !unsized.admitted(2 * time.Second) {
		t.Fatal("not admitted")
	}
	tiny := startUpload(t, "b.bin", 10, 0, context.Background())
	if tiny.admitted(300 * time.Millisecond) {
		t.Fatal("a small upload was admitted beside one with no length, which holds the whole cap")
	}
	unsized.finish(t)
	if !tiny.admitted(2 * time.Second) {
		t.Fatal("the small upload was not admitted after release")
	}
	tiny.finish(t)
}

func TestUploadReleasesOnSuccess(t *testing.T) {
	withUploadLimit(t, 4096)
	newS3Garage(t)
	if res := startUpload(t, "a.bin", 3000, 0, context.Background()).finish(t); res.Code != 200 {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	requireBudgetFree(t)
}

func TestUploadReleasesOnS3Error(t *testing.T) {
	withUploadLimit(t, 4096)
	g := newS3Garage(t)
	g.fakeGarage = newFakeGarage(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPut && strings.HasPrefix(r.URL.Path, "/test/") && !strings.HasPrefix(r.URL.Path, "/test/probe") {
			io.Copy(io.Discard, r.Body)
			w.WriteHeader(http.StatusForbidden)
			return
		}
		g.serve(w, r)
	})
	if res := startUpload(t, "a.bin", 3000, 0, context.Background()).finish(t); res.Code == 200 {
		t.Fatalf("a refused PUT answered %d", res.Code)
	}
	requireBudgetFree(t)
}

func TestUploadReleasesOnClientCancel(t *testing.T) {
	withUploadLimit(t, 4096)
	newS3Garage(t)
	ctx, cancel := context.WithCancel(context.Background())
	call := startUpload(t, "a.bin", 3000, 0, ctx)
	if !call.admitted(2 * time.Second) {
		t.Fatal("not admitted")
	}
	// The connection drops mid-body: the read fails and the handler returns.
	call.body.cutAt = true
	cancel()
	call.finish(t)
	requireBudgetFree(t)
}

func TestUploadReleasesOn413(t *testing.T) {
	withUploadLimit(t, 4096)
	g := newS3Garage(t)

	// Declared length over the cap: refused before it takes any budget.
	if res := startUpload(t, "big.bin", 8000, 0, context.Background()).finish(t); res.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("declared: %d", res.Code)
	}
	// No length and a body over the cap: charged the cap, refused while reading, released.
	if res := startUpload(t, "big.bin", 8000, -1, context.Background()).finish(t); res.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("undeclared: %d %s", res.Code, res.Body.String())
	}
	if g.has("big.bin") {
		t.Fatal("a refused upload reached S3")
	}
	requireBudgetFree(t)
}

func TestUploadWaitEndsWith503AndRetryAfter(t *testing.T) {
	withUploadLimit(t, 4096)
	old := uploadWaitLimit
	uploadWaitLimit = 200 * time.Millisecond
	t.Cleanup(func() { uploadWaitLimit = old })
	newS3Garage(t)

	hold := startUpload(t, "a.bin", 3000, 0, context.Background())
	if !hold.admitted(2 * time.Second) {
		t.Fatal("not admitted")
	}
	res := startUpload(t, "b.bin", 3000, 0, context.Background()).finish(t)
	if res.Code != http.StatusServiceUnavailable || res.Header().Get("Retry-After") == "" {
		t.Fatalf("%d, Retry-After %q, body %q", res.Code, res.Header().Get("Retry-After"), res.Body.String())
	}
	if strings.HasPrefix(res.Body.String(), "{") {
		t.Fatalf("the message must read as plain text in the toast: %q", res.Body.String())
	}
	hold.finish(t)
	requireBudgetFree(t)
}

func TestUploadWaitGivesUpWhenTheClientIsGone(t *testing.T) {
	withUploadLimit(t, 4096)
	newS3Garage(t)
	hold := startUpload(t, "a.bin", 3000, 0, context.Background())
	if !hold.admitted(2 * time.Second) {
		t.Fatal("not admitted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	waiter := startUpload(t, "b.bin", 3000, 0, ctx)
	time.Sleep(100 * time.Millisecond)
	cancel()
	waiter.finish(t)
	if waiter.admitted(100 * time.Millisecond) {
		t.Fatal("a cancelled waiter was admitted")
	}
	hold.finish(t)
	requireBudgetFree(t)
}
