package router

import (
	"net"
	"net/http"
	"sync/atomic"
	"testing"
)

// Every S3 call must reuse connections from the one shared client. A client per request left each
// keep-alive connection idle for 90 s and exhausted Garage's file descriptors under load.
func TestBrowseReusesS3Connections(t *testing.T) {
	var opened atomic.Int32
	g := &s3Garage{objects: map[string]string{}, types: map[string]string{}, hasKey: true, failDelete: map[string]bool{}}
	g.fakeGarage = newFakeGarageConn(t, g.serve, func(_ net.Conn, s http.ConnState) {
		if s == http.StateNew {
			opened.Add(1)
		}
	})
	g.put("a.txt", "a")

	const requests = 50
	for i := 0; i < requests; i++ {
		res := call((&Browse{}).GetObjects, "GET", "/browse/test", "test", "", nil, "")
		if res.Code != http.StatusOK {
			t.Fatalf("request %d: %d %s", i, res.Code, res.Body.String())
		}
	}
	// One connection for the admin credential lookups plus one for S3 is the floor; a fresh S3
	// connection per request would be 50 or more.
	if n := opened.Load(); n > 4 {
		t.Fatalf("%d sequential listings opened %d connections, want at most 4", requests, n)
	}
}
