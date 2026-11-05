package router

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
)

// s3Garage is a fake Garage for the browse handlers: the admin calls that hand out the bucket's key
// and a small in-memory S3 for bucket "test". It records the admin queries and the delete batches.
type s3Garage struct {
	*fakeGarage
	mu            sync.Mutex
	objects       map[string]string
	types         map[string]string
	hasKey        bool
	failDelete    map[string]bool
	hang          chan struct{} // when set, S3 requests announce themselves on arrived and wait
	arrived       chan struct{}
	deleteBatches []int
}

const s3Time = "Mon, 02 Jan 2006 15:04:05 GMT"

func newS3Garage(t *testing.T) *s3Garage {
	t.Helper()
	g := &s3Garage{objects: map[string]string{}, types: map[string]string{}, hasKey: true, failDelete: map[string]bool{}}
	g.fakeGarage = newFakeGarage(t, g.serve)
	return g
}

func (g *s3Garage) put(key, body string) *s3Garage {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.objects[key] = body
	return g
}

func (g *s3Garage) has(key string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	_, ok := g.objects[key]
	return ok
}

func (g *s3Garage) count() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return len(g.objects)
}

func (g *s3Garage) batches() []int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return append([]int(nil), g.deleteBatches...)
}

func (g *s3Garage) admin(path string) []string {
	var out []string
	for _, c := range g.seen() {
		if strings.HasPrefix(c.URI, "/v2/"+path) {
			out = append(out, c.URI)
		}
	}
	return out
}

func (g *s3Garage) serve(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/v2/GetBucketInfo":
		w.Header().Set("Content-Type", "application/json")
		g.mu.Lock()
		granted := g.hasKey
		g.mu.Unlock()
		if granted {
			w.Write([]byte(`{"keys":[{"accessKeyId":"test-key","permissions":{"read":true,"write":true}}]}`))
		} else {
			w.Write([]byte(`{"keys":[{"accessKeyId":"readonly-key","permissions":{"read":true,"write":false}}]}`))
		}
		return
	case "/v2/GetKeyInfo":
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"accessKeyId":"test-key","secretAccessKey":"test-secret"}`))
		return
	}
	rest, ok := strings.CutPrefix(r.URL.Path, "/test")
	if !ok {
		http.NotFound(w, r)
		return
	}
	if g.hang != nil {
		g.arrived <- struct{}{}
		select {
		case <-g.hang:
		case <-r.Context().Done():
		}
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	key := strings.TrimPrefix(rest, "/")
	switch {
	case key == "" && r.Method == http.MethodGet:
		g.list(w, r)
	case key == "" && r.Method == http.MethodPost && r.URL.Query().Has("delete"):
		g.deleteMany(w, r)
	case r.Method == http.MethodPut:
		body, _ := io.ReadAll(r.Body)
		g.objects[key] = string(body)
		w.Header().Set("ETag", `"etag"`)
	case r.Method == http.MethodDelete:
		delete(g.objects, key)
		w.WriteHeader(http.StatusNoContent)
	case r.Method == http.MethodGet || r.Method == http.MethodHead:
		body, found := g.objects[key]
		if !found {
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(http.StatusNotFound)
			if r.Method == http.MethodGet {
				fmt.Fprint(w, `<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`)
			}
			return
		}
		w.Header().Set("Last-Modified", s3Time)
		w.Header().Set("ETag", `"etag"`)
		if typ := g.types[key]; typ != "" {
			w.Header().Set("Content-Type", typ)
		}
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		if r.Method == http.MethodGet {
			io.WriteString(w, body)
		}
	default:
		http.Error(w, "unsupported", http.StatusNotImplemented)
	}
}

// list answers ListObjectsV2 with prefix, delimiter, max-keys (default 1000) and continuation token.
func (g *s3Garage) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	prefix, delimiter := q.Get("prefix"), q.Get("delimiter")
	max := 1000
	if v, err := strconv.Atoi(q.Get("max-keys")); err == nil {
		max = v
	}
	keys := make([]string, 0, len(g.objects))
	for k := range g.objects {
		if strings.HasPrefix(k, prefix) && k > q.Get("continuation-token") {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	var contents, prefixes []string
	seen := map[string]bool{}
	next, truncated := "", false
	for _, k := range keys {
		entry := k
		if delimiter != "" {
			if i := strings.Index(strings.TrimPrefix(k, prefix), delimiter); i >= 0 {
				entry = prefix + strings.TrimPrefix(k, prefix)[:i+len(delimiter)]
			}
		}
		if entry != k && seen[entry] {
			continue
		}
		if len(contents)+len(prefixes) == max {
			truncated = true
			break
		}
		next = k
		if entry != k {
			seen[entry] = true
			prefixes = append(prefixes, entry)
		} else {
			contents = append(contents, k)
		}
	}
	var b strings.Builder
	b.WriteString(`<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>test</Name>`)
	fmt.Fprintf(&b, "<KeyCount>%d</KeyCount><MaxKeys>%d</MaxKeys><IsTruncated>%v</IsTruncated>", len(contents)+len(prefixes), max, truncated)
	if truncated {
		fmt.Fprintf(&b, "<NextContinuationToken>%s</NextContinuationToken>", next)
	}
	for _, k := range contents {
		fmt.Fprintf(&b, "<Contents><Key>%s</Key><Size>%d</Size></Contents>", k, len(g.objects[k]))
	}
	for _, p := range prefixes {
		fmt.Fprintf(&b, "<CommonPrefixes><Prefix>%s</Prefix></CommonPrefixes>", p)
	}
	b.WriteString("</ListBucketResult>")
	w.Header().Set("Content-Type", "application/xml")
	io.WriteString(w, b.String())
}

func (g *s3Garage) deleteMany(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Objects []struct {
			Key string `xml:"Key"`
		} `xml:"Object"`
	}
	body, _ := io.ReadAll(r.Body)
	if err := xml.Unmarshal(body, &req); err != nil || len(req.Objects) > 1000 {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprint(w, `<Error><Code>MalformedXML</Code><Message>bad delete request</Message></Error>`)
		return
	}
	g.deleteBatches = append(g.deleteBatches, len(req.Objects))
	var b strings.Builder
	b.WriteString(`<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">`)
	for _, o := range req.Objects {
		if g.failDelete[o.Key] {
			fmt.Fprintf(&b, "<Error><Key>%s</Key><Code>AccessDenied</Code><Message>denied</Message></Error>", o.Key)
			continue
		}
		delete(g.objects, o.Key)
		fmt.Fprintf(&b, "<Deleted><Key>%s</Key></Deleted>", o.Key)
	}
	b.WriteString("</DeleteResult>")
	w.Header().Set("Content-Type", "application/xml")
	io.WriteString(w, b.String())
}

// call runs one browse handler as the mux would, without the session and origin layers.
func call(handler func(http.ResponseWriter, *http.Request), method, target, bucket, key string, body io.Reader, contentType string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, body)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	req.SetPathValue("bucket", bucket)
	req.SetPathValue("key", key)
	res := httptest.NewRecorder()
	handler(res, req)
	return res
}

func multipartFile(t *testing.T, name string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, err := mw.CreateFormFile("file", name)
	if err != nil {
		t.Fatal(err)
	}
	part.Write(content)
	mw.Close()
	return &buf, mw.FormDataContentType()
}

func query(pairs ...string) string {
	v := url.Values{}
	for i := 0; i < len(pairs); i += 2 {
		v.Set(pairs[i], pairs[i+1])
	}
	return v.Encode()
}
