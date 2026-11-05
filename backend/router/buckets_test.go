package router

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestBucketDetailFailureDoesNotInventZeroMetrics(t *testing.T) {
	for _, failure := range []string{"http", "json"} {
		t.Run(failure, func(t *testing.T) {
			garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/v2/ListBuckets" {
					w.Write([]byte(`[{"id":"available"},{"id":"unavailable"}]`))
				} else if r.URL.Query().Get("id") == "available" {
					w.Write([]byte(`{"id":"available","bytes":100,"objects":1}`))
				} else if failure == "http" {
					http.Error(w, "unavailable", 503)
				} else {
					w.Write([]byte(`not-json`))
				}
			}))
			defer garage.Close()
			t.Setenv("API_BASE_URL", garage.URL)
			t.Setenv("API_ADMIN_KEY", "test-admin")
			res := httptest.NewRecorder()
			(&Buckets{}).GetAll(res, httptest.NewRequest("GET", "/buckets", nil))
			if res.Code != http.StatusInternalServerError || strings.Contains(res.Body.String(), `"bytes":0`) {
				t.Fatalf("missing metrics reported as a successful zero: %d %s", res.Code, res.Body.String())
			}
		})
	}
}

// D12: the per-bucket detail calls run with bounded concurrency and the result is complete.
func TestBucketListFansOutWithABound(t *testing.T) {
	const buckets = 40
	var inflight, peak atomic.Int32
	garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/ListBuckets" {
			var list []string
			for i := 0; i < buckets; i++ {
				list = append(list, fmt.Sprintf(`{"id":"b%02d"}`, i))
			}
			w.Write([]byte("[" + strings.Join(list, ",") + "]"))
			return
		}
		n := inflight.Add(1)
		defer inflight.Add(-1)
		for {
			p := peak.Load()
			if n <= p || peak.CompareAndSwap(p, n) {
				break
			}
		}
		time.Sleep(20 * time.Millisecond)
		w.Write([]byte(`{"id":"` + r.URL.Query().Get("id") + `"}`))
	}))
	defer garage.Close()
	t.Setenv("API_BASE_URL", garage.URL)
	t.Setenv("API_ADMIN_KEY", "test-admin")
	res := httptest.NewRecorder()
	(&Buckets{}).GetAll(res, httptest.NewRequest("GET", "/buckets", nil))
	var got []struct{ ID string }
	if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil || res.Code != 200 || len(got) != buckets {
		t.Fatalf("%d %d buckets: %s", res.Code, len(got), res.Body.String())
	}
	if p := peak.Load(); p > 8 || p < 2 {
		t.Fatalf("peak concurrent admin calls %d, want 2..8", p)
	}
	for i, b := range got {
		if b.ID != fmt.Sprintf("b%02d", i) {
			t.Fatalf("bucket %d is %s: the list must keep Garage's order", i, b.ID)
		}
	}
}
