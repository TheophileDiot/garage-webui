package router

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// A download never takes a thumbnail slot, even when the URL also carries thumb=1.
func TestDownloadWithThumbFlagTakesNoSlot(t *testing.T) {
	png := encodePNG(t, 40, 40)
	g := newS3Garage(t)
	g.fakeGarage = newFakeGarage(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/test/") {
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
			w.Write(png)
			return
		}
		g.serve(w, r)
	})

	for i := 0; i < cap(thumbnailSlots); i++ {
		thumbnailSlots <- struct{}{}
	}
	t.Cleanup(func() {
		for len(thumbnailSlots) > 0 {
			<-thumbnailSlots
		}
	})

	req := httptest.NewRequest("GET", "/browse/test/a.png?thumb=1&dl=1", nil)
	req.SetPathValue("bucket", "test")
	req.SetPathValue("key", "a.png")
	res := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		(&Browse{}).GetOneObject(res, req)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("thumb=1&dl=1 waits for a thumbnail slot")
	}

	if res.Code != 200 {
		t.Errorf("status %d, want 200", res.Code)
	}
	if !strings.Contains(res.Header().Get("Content-Disposition"), "attachment") {
		t.Errorf("Content-Disposition %q, want an attachment", res.Header().Get("Content-Disposition"))
	}
	if !bytes.Equal(res.Body.Bytes(), png) {
		t.Errorf("body is %d bytes, want the original %d-byte object", res.Body.Len(), len(png))
	}
	if n := len(thumbnailSlots); n != cap(thumbnailSlots) {
		t.Errorf("%d slots taken, want the %d held by the test", n, cap(thumbnailSlots))
	}
}

// A thumbnail request waiting for a decode slot must hold nothing: no S3 response, no body, no buffer.
func TestQueuedThumbnailsHoldNoMemory(t *testing.T) {
	png := encodePNG(t, 40, 40)
	var objectGets atomic.Int32
	entered := make(chan struct{}, 16)
	gate := make(chan struct{})
	var once sync.Once
	release := func() { once.Do(func() { close(gate) }) }
	g := newS3Garage(t)
	g.fakeGarage = newFakeGarage(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/test/") {
			objectGets.Add(1)
			if !strings.HasSuffix(r.URL.Path, "/open.png") { // open.png is the one request that is never gated
				entered <- struct{}{}
				select {
				case <-gate:
				case <-r.Context().Done():
					return
				}
			}
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
			w.Write(png)
			return
		}
		g.serve(w, r)
	})
	t.Cleanup(release) // registered after the server, so it runs first: Close waits for blocked handlers

	type result struct {
		name string
		code int
	}
	results := make(chan result, 16)
	fire := func(name, key, query string, ctx context.Context) {
		req := httptest.NewRequest("GET", "/browse/test/"+key+"?"+query, nil).WithContext(ctx)
		req.SetPathValue("bucket", "test")
		req.SetPathValue("key", key)
		go func() {
			res := httptest.NewRecorder()
			(&Browse{}).GetOneObject(res, req)
			results <- result{name, res.Code}
		}()
	}
	wait := func(want int) []result {
		t.Helper()
		var got []result
		for len(got) < want {
			select {
			case r := <-results:
				got = append(got, r)
			case <-time.After(5 * time.Second):
				t.Fatalf("only %d of %d requests returned", len(got), want)
			}
		}
		return got
	}

	// Fill both slots with requests blocked inside S3.
	bg := context.Background()
	fire("a", "a.png", "thumb=1", bg)
	fire("b", "b.png", "thumb=1", bg)
	for i := 0; i < 2; i++ {
		<-entered
	}
	if n := len(thumbnailSlots); n != 2 {
		t.Errorf("%d slots taken, want 2", n)
	}

	// Four more queue up: two will be cancelled, two will wait for a slot.
	cancelCtx, cancel := context.WithCancel(bg)
	defer cancel()
	fire("c1", "c1.png", "thumb=1", cancelCtx)
	fire("c2", "c2.png", "thumb=1", cancelCtx)
	fire("q1", "q1.png", "thumb=1", bg)
	fire("q2", "q2.png", "thumb=1", bg)
	time.Sleep(300 * time.Millisecond)
	if n := objectGets.Load(); n != 2 {
		t.Fatalf("%d object reads while both slots are full, want 2: a queued request reached S3", n)
	}

	// A request that is not a thumbnail does not use the slots.
	fire("open", "open.png", "view=1", bg)
	if r := wait(1)[0]; r.name != "open" || r.code != 200 {
		t.Fatalf("view request while slots are full: %+v", r)
	}

	// Cancelled requests leave the queue without calling S3.
	cancel()
	got := wait(2)
	for _, r := range got {
		if r.name != "c1" && r.name != "c2" {
			t.Fatalf("%q returned before the slots were released", r.name)
		}
	}
	if n := objectGets.Load(); n != 3 { // a, b and the view request
		t.Fatalf("%d object reads after cancel, want 3", n)
	}

	// Releasing the slots lets the rest through, each with a thumbnail.
	release()
	for _, r := range wait(4) {
		if r.code != 200 {
			t.Errorf("%s: status %d, want 200", r.name, r.code)
		}
	}
	if n := objectGets.Load(); n != 5 { // a, b, view, q1, q2: never the cancelled two
		t.Errorf("%d object reads in total, want 5", n)
	}
	if n := len(thumbnailSlots); n != 0 {
		t.Errorf("%d slots still taken, want 0", n)
	}
}
