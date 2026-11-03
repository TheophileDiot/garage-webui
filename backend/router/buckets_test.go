package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
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
