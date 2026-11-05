package router

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"khairul169/garage-webui/utils"
)

// D1: a failed HEAD answers once, with the error, and nothing is appended to it.
func TestHeadOfMissingObjectAnswersOnce(t *testing.T) {
	newS3Garage(t)
	var serverLog bytes.Buffer
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.SetPathValue("bucket", "test")
		r.SetPathValue("key", "missing.txt")
		(&Browse{}).GetOneObject(w, r)
	}))
	srv.Config.ErrorLog = log.New(&serverLog, "", 0)
	srv.Start()
	defer srv.Close()
	res, err := http.Get(srv.URL + "/browse/test/missing.txt")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusInternalServerError || strings.Contains(string(body), "null") {
		t.Fatalf("%d %q", res.StatusCode, body)
	}
	if strings.Contains(serverLog.String(), "superfluous") {
		t.Fatalf("second WriteHeader: %s", serverLog.String())
	}
}

// D2: the Content-Type of a thumbnail names the format of the bytes sent.
func TestThumbnailContentTypeMatchesItsBytes(t *testing.T) {
	var src bytes.Buffer
	if err := png.Encode(&src, image.NewRGBA(image.Rect(0, 0, 40, 40))); err != nil {
		t.Fatal(err)
	}
	g := newS3Garage(t)
	g.put("a.png", src.String())
	res := call((&Browse{}).GetOneObject, "GET", "/browse/test/a.png?thumb=1", "test", "a.png", nil, "")
	_, format, err := image.DecodeConfig(bytes.NewReader(res.Body.Bytes()))
	if err != nil || res.Code != 200 {
		t.Fatalf("%d %v", res.Code, err)
	}
	if got, want := res.Header().Get("Content-Type"), "image/"+format; got != want {
		t.Fatalf("Content-Type %q for a %s body", got, format)
	}
}

// D3: a bucket without a read+write key fails with a clear message, caches nothing, and works as
// soon as a key is granted.
func TestBucketWithoutUsableKeyIsNotCached(t *testing.T) {
	g := newS3Garage(t)
	g.put("a.txt", "A")
	g.mu.Lock()
	g.hasKey = false
	g.mu.Unlock()
	res := call((&Browse{}).GetObjects, "GET", "/browse/test", "test", "", nil, "")
	if res.Code != http.StatusInternalServerError || !strings.Contains(res.Body.String(), "no access key with read and write permission") {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	if strings.Contains(res.Body.String(), "S3") {
		t.Fatalf("opaque S3 failure: %s", res.Body.String())
	}
	for _, c := range g.seen() {
		if strings.HasPrefix(c.URI, "/test") {
			t.Fatalf("S3 was called with empty credentials: %s", c.URI)
		}
	}
	g.mu.Lock()
	g.hasKey = true
	g.mu.Unlock()
	ok := call((&Browse{}).GetObjects, "GET", "/browse/test", "test", "", nil, "")
	if ok.Code != 200 || !strings.Contains(ok.Body.String(), "a.txt") {
		t.Fatalf("after the grant: %d %s", ok.Code, ok.Body.String())
	}
}

// D4: names are data, never query syntax.
func TestAdminQueriesEscapeTheirValues(t *testing.T) {
	g := newS3Garage(t)
	call((&Browse{}).GetObjects, "GET", "/browse/x", "x&id=abc", "", nil, "")
	infos := g.admin("GetBucketInfo")
	if len(infos) != 1 {
		t.Fatalf("%v", infos)
	}
	q := mustQuery(t, infos[0])
	if q.Get("globalAlias") != "x&id=abc" || q.Has("id") {
		t.Fatalf("bucket name injected a parameter: %s", infos[0])
	}
}

func TestBucketAndKeyIDsAreEscapedInAdminCalls(t *testing.T) {
	var seen []string
	garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.RequestURI)
		switch r.URL.Path {
		case "/v2/ListBuckets":
			w.Write([]byte(`[{"id":"a&b=c d"}]`))
		case "/v2/GetBucketInfo":
			w.Write([]byte(`{"keys":[{"accessKeyId":"k&x=1","permissions":{"read":true,"write":true}}]}`))
		default:
			w.Write([]byte(`{"id":"x","accessKeyId":"k&x=1","secretAccessKey":"s"}`))
		}
	}))
	defer garage.Close()
	t.Setenv("API_BASE_URL", garage.URL)
	t.Setenv("S3_ENDPOINT_URL", garage.URL)
	t.Setenv("API_ADMIN_KEY", "test-admin")
	utils.InitCacheManager()
	(&Buckets{}).GetAll(httptest.NewRecorder(), httptest.NewRequest("GET", "/buckets", nil))
	call((&Browse{}).GetObjects, "GET", "/browse/test", "test", "", nil, "")
	for _, uri := range seen {
		q := mustQuery(t, uri)
		switch {
		case strings.HasPrefix(uri, "/v2/GetBucketInfo?id="):
			if q.Get("id") != "a&b=c d" || len(q) != 1 {
				t.Errorf("bucket id: %s", uri)
			}
		case strings.HasPrefix(uri, "/v2/GetKeyInfo"):
			if q.Get("id") != "k&x=1" || q.Get("showSecretKey") != "true" || len(q) != 2 {
				t.Errorf("key id: %s", uri)
			}
		}
	}
}

func mustQuery(t *testing.T, uri string) url.Values {
	t.Helper()
	u, err := url.ParseRequestURI(uri)
	if err != nil {
		t.Fatal(err)
	}
	return u.Query()
}

// D5 + G10: a recursive delete pages through the whole prefix and deletes in batches of at most 1000.
func TestRecursiveDeleteCoversEveryPage(t *testing.T) {
	g := newS3Garage(t)
	g.put("keep.txt", "K").put("bigger/other.txt", "O")
	for i := 0; i < 1500; i++ {
		g.put(fmt.Sprintf("big/%04d.txt", i), "x")
	}
	res := call((&Browse{}).DeleteObject, "DELETE", "/browse/test/big/?recursive=true", "test", "big/", nil, "")
	if res.Code != http.StatusOK {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	if g.count() != 2 || !g.has("keep.txt") || !g.has("bigger/other.txt") {
		t.Fatalf("%d objects left, want the 2 outside the folder", g.count())
	}
	total := 0
	for _, n := range g.batches() {
		if n > 1000 {
			t.Errorf("batch of %d", n)
		}
		total += n
	}
	if total != 1500 {
		t.Fatalf("deleted %d keys in batches %v", total, g.batches())
	}
}

func TestRecursiveDeleteReportsPartialFailure(t *testing.T) {
	g := newS3Garage(t)
	for i := 0; i < 5; i++ {
		g.put(fmt.Sprintf("dir/%d.txt", i), "x")
	}
	g.failDelete["dir/1.txt"], g.failDelete["dir/3.txt"] = true, true
	res := call((&Browse{}).DeleteObject, "DELETE", "/browse/test/dir/?recursive=true", "test", "dir/", nil, "")
	if res.Code != http.StatusInternalServerError || !strings.Contains(res.Body.String(), "2 of 5") || !strings.Contains(res.Body.String(), "dir/1.txt") {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	if g.count() != 2 || !g.has("dir/1.txt") || !g.has("dir/3.txt") {
		t.Fatalf("the other objects must still be deleted: %d left", g.count())
	}
}

// D6: a client that goes away cancels the S3 call made for it.
func TestS3CallsFollowTheRequestContext(t *testing.T) {
	file, contentType := multipartFile(t, "a.txt", []byte("payload"))
	for _, tc := range []struct {
		name    string
		handler func(http.ResponseWriter, *http.Request)
		method  string
		target  string
		key     string
		body    io.Reader
		ctype   string
	}{
		{"list", (&Browse{}).GetObjects, "GET", "/browse/test", "", nil, ""},
		{"head", (&Browse{}).GetOneObject, "GET", "/browse/test/a.txt", "a.txt", nil, ""},
		{"download", (&Browse{}).GetOneObject, "GET", "/browse/test/a.txt?dl=1", "a.txt", nil, ""},
		{"upload", (&Browse{}).PutObject, "PUT", "/browse/test/a.txt", "a.txt", file, contentType},
		{"delete", (&Browse{}).DeleteObject, "DELETE", "/browse/test/a.txt", "a.txt", nil, ""},
		{"recursive delete", (&Browse{}).DeleteObject, "DELETE", "/browse/test/dir/?recursive=true", "dir/", nil, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			g := newS3Garage(t)
			g.hang, g.arrived = make(chan struct{}), make(chan struct{}, 8)
			t.Cleanup(func() { close(g.hang) })
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			req := httptest.NewRequest(tc.method, tc.target, tc.body).WithContext(ctx)
			if tc.ctype != "" {
				req.Header.Set("Content-Type", tc.ctype)
			}
			req.SetPathValue("bucket", "test")
			req.SetPathValue("key", tc.key)
			done := make(chan struct{})
			go func() { defer close(done); tc.handler(httptest.NewRecorder(), req) }()
			select {
			case <-g.arrived:
			case <-time.After(5 * time.Second):
				t.Fatal("the handler never reached S3")
			}
			cancel()
			select {
			case <-done:
			case <-time.After(3 * time.Second):
				t.Fatal("the handler kept waiting on S3 after its request was cancelled")
			}
		})
	}
}

// D7: limit is 1..1000 or the request is refused; absent keeps the default of 100.
func TestListingLimitIsValidated(t *testing.T) {
	for _, tc := range []struct{ target, want string }{
		{"/browse/test", "100"},
		{"/browse/test?limit=1", "1"},
		{"/browse/test?limit=1000", "1000"},
	} {
		g := newS3Garage(t)
		g.put("a.txt", "A")
		res := call((&Browse{}).GetObjects, "GET", tc.target, "test", "", nil, "")
		if res.Code != 200 {
			t.Fatalf("%s: %d %s", tc.target, res.Code, res.Body.String())
		}
		var got string
		for _, c := range g.seen() {
			if strings.HasPrefix(c.URI, "/test?") {
				got = mustQuery(t, c.URI).Get("max-keys")
			}
		}
		if got != tc.want {
			t.Errorf("%s: max-keys %q, want %q", tc.target, got, tc.want)
		}
	}
	for _, bad := range []string{"0", "-1", "1001", "abc", "4294967396", "1.5", ""} {
		g := newS3Garage(t)
		res := call((&Browse{}).GetObjects, "GET", "/browse/test?limit="+bad, "test", "", nil, "")
		if res.Code != http.StatusBadRequest || !strings.Contains(res.Body.String(), "limit") {
			t.Errorf("limit=%q: %d %s", bad, res.Code, res.Body.String())
		}
		if len(g.seen()) != 0 {
			t.Errorf("limit=%q: Garage was called", bad)
		}
	}
}

// D8: an upload is capped; over the cap is a 413 with a readable body and S3 is never called.
func TestUploadOverTheCapIsRefused(t *testing.T) {
	old := maxUploadBytes
	maxUploadBytes = 4096
	t.Cleanup(func() { maxUploadBytes = old })
	g := newS3Garage(t)

	big, contentType := multipartFile(t, "big.bin", bytes.Repeat([]byte("x"), 64*1024))
	res := call((&Browse{}).PutObject, "PUT", "/browse/test/big.bin", "test", "big.bin", big, contentType)
	if res.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	if !strings.Contains(res.Body.String(), "4096") || strings.HasPrefix(res.Body.String(), "{") || strings.Contains(res.Header().Get("Content-Type"), "json") {
		t.Fatalf("the body must be plain readable text: %q (%s)", res.Body.String(), res.Header().Get("Content-Type"))
	}
	if g.has("big.bin") || len(g.admin("GetBucketInfo")) != 0 {
		t.Fatal("a refused upload reached Garage")
	}

	small, contentType := multipartFile(t, "small.bin", []byte("fits"))
	if ok := call((&Browse{}).PutObject, "PUT", "/browse/test/small.bin", "test", "small.bin", small, contentType); ok.Code != 200 || !g.has("small.bin") {
		t.Fatalf("an upload under the cap failed: %d %s", ok.Code, ok.Body.String())
	}
	if folder := call((&Browse{}).PutObject, "PUT", "/browse/test/dir/", "test", "dir/", nil, ""); folder.Code != 200 {
		t.Fatalf("folder creation: %d", folder.Code)
	}
}

func TestUploadLimitSetting(t *testing.T) {
	for _, tc := range []struct {
		raw  string
		want int64
		ok   bool
	}{
		{"", 5368709120, true},
		{"1", 1, true},
		{"5368709120", 5368709120, true},
		{"1073741824", 1073741824, true},
		{"0", 0, false},
		{"-1", 0, false},
		{"abc", 0, false},
		{"1.5", 0, false},
		{"5GiB", 0, false},
		{" 7", 0, false},
		{"99999999999999999999", 0, false},
	} {
		got, err := parseUploadLimit(tc.raw)
		if (err == nil) != tc.ok || (tc.ok && got != tc.want) {
			t.Errorf("%q: %d, %v", tc.raw, got, err)
		}
		if err != nil && !strings.Contains(err.Error(), "UPLOAD_MAX_BYTES") {
			t.Errorf("%q: unclear message %q", tc.raw, err)
		}
	}
}

func TestLoadUploadLimitReadsTheEnvironment(t *testing.T) {
	old := maxUploadBytes
	t.Cleanup(func() { maxUploadBytes = old })
	t.Setenv("UPLOAD_MAX_BYTES", "")
	if err := LoadUploadLimit(); err != nil || maxUploadBytes != 5368709120 {
		t.Fatalf("default: %d %v", maxUploadBytes, err)
	}
	t.Setenv("UPLOAD_MAX_BYTES", "2048")
	if err := LoadUploadLimit(); err != nil || maxUploadBytes != 2048 {
		t.Fatalf("2048: %d %v", maxUploadBytes, err)
	}
	t.Setenv("UPLOAD_MAX_BYTES", "-3")
	if err := LoadUploadLimit(); err == nil || maxUploadBytes != 2048 {
		t.Fatalf("an invalid value must be an error and change nothing: %d %v", maxUploadBytes, err)
	}
}
