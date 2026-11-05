package router

import (
	"bytes"
	"encoding/json"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// These tests pin what the browse and bucket handlers do today, so the refactors that move code
// (G1, G2, G10) are visible as a failing test if they change a byte of it.

func TestBrowseListsPrefixesAndObjects(t *testing.T) {
	g := newS3Garage(t)
	g.put("a.txt", "A").put("dir/b.txt", "BB").put("dir/c.txt", "CCC")
	res := call((&Browse{}).GetObjects, "GET", "/browse/test?"+query("prefix", "dir/"), "test", "", nil, "")
	var body struct {
		Prefix   string
		Prefixes []string
		Objects  []struct {
			ObjectKey string `json:"objectKey"`
			Size      int64
			URL       string `json:"url"`
		}
		NextToken *string
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || res.Code != 200 {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	if len(body.Objects) != 2 || body.Objects[0].ObjectKey != "b.txt" || body.Objects[1].Size != 3 || body.Objects[0].URL != "/browse/test/dir%2Fb.txt" {
		t.Fatalf("%s", res.Body.String())
	}
	root := call((&Browse{}).GetObjects, "GET", "/browse/test", "test", "", nil, "")
	if !strings.Contains(root.Body.String(), `"prefixes":["dir/"]`) || !strings.Contains(root.Body.String(), `"objectKey":"a.txt"`) {
		t.Fatalf("%s", root.Body.String())
	}
	page := call((&Browse{}).GetObjects, "GET", "/browse/test?limit=1", "test", "", nil, "")
	if !strings.Contains(page.Body.String(), `"nextToken":"`) {
		t.Fatalf("no next token: %s", page.Body.String())
	}
}

func TestBrowseHeadReturnsObjectMetadata(t *testing.T) {
	g := newS3Garage(t)
	g.put("a.txt", "hello")
	res := call((&Browse{}).GetOneObject, "GET", "/browse/test/a.txt", "test", "a.txt", nil, "")
	var meta map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &meta); err != nil || res.Code != 200 || meta["ContentLength"] != float64(5) {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
}

func TestBrowseServesTheObjectWithItsHeaders(t *testing.T) {
	g := newS3Garage(t)
	g.put("docs/a.txt", "hello")
	g.types["docs/a.txt"] = "text/plain"
	res := call((&Browse{}).GetOneObject, "GET", "/browse/test/docs/a.txt?view=1", "test", "docs/a.txt", nil, "")
	h := res.Header()
	if res.Code != 200 || res.Body.String() != "hello" || h.Get("Content-Type") != "text/plain" || h.Get("Content-Length") != "5" || h.Get("Etag") != `"etag"` || h.Get("Last-Modified") == "" {
		t.Fatalf("%d %v %q", res.Code, h, res.Body.String())
	}
	if !strings.Contains(h.Get("Content-Security-Policy"), "sandbox") || h.Get("Cache-Control") != "no-store" || h.Get("Content-Disposition") != "" {
		t.Fatalf("%v", h)
	}
	dl := call((&Browse{}).GetOneObject, "GET", "/browse/test/docs/a.txt?dl=1", "test", "docs/a.txt", nil, "")
	if !strings.HasPrefix(dl.Header().Get("Content-Disposition"), `attachment; filename=a.txt`) {
		t.Fatalf("%q", dl.Header().Get("Content-Disposition"))
	}
}

func TestBrowseMissingObjectIs404ForDownloads(t *testing.T) {
	newS3Garage(t)
	res := call((&Browse{}).GetOneObject, "GET", "/browse/test/none.txt?view=1", "test", "none.txt", nil, "")
	if res.Code != http.StatusNotFound || !strings.Contains(res.Body.String(), "NoSuchKey") {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
}

func TestBrowseThumbnailIsADownscaledImage(t *testing.T) {
	g := newS3Garage(t)
	var src bytes.Buffer
	if err := png.Encode(&src, image.NewRGBA(image.Rect(0, 0, 200, 100))); err != nil {
		t.Fatal(err)
	}
	g.put("a.png", src.String())
	res := call((&Browse{}).GetOneObject, "GET", "/browse/test/a.png?thumb=1", "test", "a.png", nil, "")
	if res.Code != 200 {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	img, _, err := image.Decode(res.Body)
	if err != nil || img.Bounds().Dx() > 64 || img.Bounds().Dy() > 64 {
		t.Fatalf("thumbnail: %v %v", err, img)
	}
	bad := call((&Browse{}).GetOneObject, "GET", "/browse/test/a.txt?thumb=1", "test", "a.txt", nil, "")
	if bad.Code == 200 {
		t.Fatal("a missing object produced a thumbnail")
	}
}

func TestBrowseUploadsFilesAndFolders(t *testing.T) {
	g := newS3Garage(t)
	body, contentType := multipartFile(t, "a.txt", []byte("payload"))
	res := call((&Browse{}).PutObject, "PUT", "/browse/test/in/a.txt", "test", "in/a.txt", body, contentType)
	if res.Code != 200 || !g.has("in/a.txt") {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	folder := call((&Browse{}).PutObject, "PUT", "/browse/test/empty/", "test", "empty/", nil, "")
	if folder.Code != 200 || !g.has("empty/") {
		t.Fatalf("%d %s", folder.Code, folder.Body.String())
	}
	noFile := call((&Browse{}).PutObject, "PUT", "/browse/test/x.txt", "test", "x.txt", strings.NewReader(""), "")
	if noFile.Code == 200 || g.has("x.txt") {
		t.Fatalf("a file key without a file was accepted: %d", noFile.Code)
	}
}

func TestBrowseDeletesObjectsAndFolders(t *testing.T) {
	g := newS3Garage(t)
	g.put("a.txt", "A").put("dir/b.txt", "B").put("dir/sub/c.txt", "C").put("keep.txt", "K")
	if res := call((&Browse{}).DeleteObject, "DELETE", "/browse/test/a.txt", "test", "a.txt", nil, ""); res.Code != 200 || g.has("a.txt") {
		t.Fatalf("single: %d %s", res.Code, res.Body.String())
	}
	if res := call((&Browse{}).DeleteObject, "DELETE", "/browse/test/dir/", "test", "dir/", nil, ""); res.Code != 200 || !g.has("dir/b.txt") {
		t.Fatalf("a folder without recursive=true must not be emptied: %d", res.Code)
	}
	res := call((&Browse{}).DeleteObject, "DELETE", "/browse/test/dir/?recursive=true", "test", "dir/", nil, "")
	if res.Code != 200 || g.has("dir/b.txt") || g.has("dir/sub/c.txt") || !g.has("keep.txt") {
		t.Fatalf("recursive: %d %s", res.Code, res.Body.String())
	}
	if empty := call((&Browse{}).DeleteObject, "DELETE", "/browse/test/none/?recursive=true", "test", "none/", nil, ""); empty.Code != 200 {
		t.Fatalf("empty folder: %d", empty.Code)
	}
}

func TestBrowseReusesCachedCredentials(t *testing.T) {
	g := newS3Garage(t)
	g.put("a.txt", "A")
	for range 3 {
		call((&Browse{}).GetObjects, "GET", "/browse/test", "test", "", nil, "")
	}
	if n := len(g.admin("GetBucketInfo")); n != 1 {
		t.Fatalf("%d GetBucketInfo calls for three requests", n)
	}
	if n := len(g.admin("GetKeyInfo")); n != 1 {
		t.Fatalf("%d GetKeyInfo calls for three requests", n)
	}
}

func TestBucketListKeepsGarageOrderAndAliases(t *testing.T) {
	garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/ListBuckets" {
			w.Write([]byte(`[{"id":"b1","localAliases":[{"accessKeyId":"k","alias":"mine"}]},{"id":"b2"},{"id":"b3"}]`))
			return
		}
		id := r.URL.Query().Get("id")
		w.Write([]byte(`{"id":"` + id + `","bytes":7}`))
	}))
	defer garage.Close()
	t.Setenv("API_BASE_URL", garage.URL)
	t.Setenv("API_ADMIN_KEY", "test-admin")
	res := httptest.NewRecorder()
	(&Buckets{}).GetAll(res, httptest.NewRequest("GET", "/buckets", nil))
	var got []struct {
		ID           string
		Bytes        int
		LocalAliases []struct{ Alias string }
	}
	if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil || res.Code != 200 || len(got) != 3 {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	ids := map[string]bool{}
	for _, b := range got {
		ids[b.ID] = true
		if b.Bytes != 7 {
			t.Errorf("%+v", b)
		}
		if b.ID == "b1" && (len(b.LocalAliases) != 1 || b.LocalAliases[0].Alias != "mine") {
			t.Errorf("aliases lost: %+v", b)
		}
	}
	if !ids["b1"] || !ids["b2"] || !ids["b3"] {
		t.Fatalf("%v", ids)
	}
}

// The thumbnail bytes are a JPEG today; D2 fixes the label, not the bytes.
func TestThumbnailBytesAreJPEG(t *testing.T) {
	var src bytes.Buffer
	png.Encode(&src, image.NewRGBA(image.Rect(0, 0, 10, 10)))
	g := newS3Garage(t)
	g.put("a.png", src.String())
	res := call((&Browse{}).GetOneObject, "GET", "/browse/test/a.png?thumb=1", "test", "a.png", nil, "")
	if _, err := jpeg.Decode(bytes.NewReader(res.Body.Bytes())); err != nil {
		t.Fatalf("not a JPEG: %v", err)
	}
}
