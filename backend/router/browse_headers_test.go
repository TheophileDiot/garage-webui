package router

import (
	"bytes"
	"image"
	"image/png"
	"mime"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"khairul169/garage-webui/utils"
)

func browseOne(t *testing.T, key, query string, body []byte, contentType string) *httptest.ResponseRecorder {
	t.Helper()
	garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/v2/GetBucketInfo":
			w.Write([]byte(`{"keys":[{"accessKeyId":"test-key","permissions":{"read":true,"write":true}}]}`))
		case r.URL.Path == "/v2/GetKeyInfo":
			w.Write([]byte(`{"accessKeyId":"test-key","secretAccessKey":"test-secret"}`))
		case strings.HasPrefix(r.URL.Path, "/test/"):
			w.Header().Set("Content-Type", contentType)
			w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
			w.Write(body)
		default:
			http.NotFound(w, r)
		}
	}))
	defer garage.Close()
	t.Setenv("API_BASE_URL", garage.URL)
	t.Setenv("S3_ENDPOINT_URL", garage.URL)
	t.Setenv("API_ADMIN_KEY", "test-admin")
	utils.InitCacheManager()
	req := httptest.NewRequest("GET", "/browse/test/x?"+query, nil)
	req.SetPathValue("bucket", "test")
	req.SetPathValue("key", key)
	res := httptest.NewRecorder()
	(&Browse{}).GetOneObject(res, req)
	return res
}

func TestDownloadFilenameIsEncodedSafely(t *testing.T) {
	cases := []struct {
		key      string
		wantName string // what a browser must end up with
	}{
		{"folder/plain.txt", "plain.txt"},
		{"folder/with space.txt", "with space.txt"},
		{`folder/quo"te.txt`, `quo"te.txt`},
		{"folder/semi;colon.txt", "semi;colon.txt"},
		{`folder/back\slash.txt`, "back_slash.txt"},
		{"folder/ü.txt", "ü.txt"},
		{"folder/日本語.txt", "日本語.txt"},
		{"folder/line\r\nbreak.txt", "line__break.txt"},
		{"folder/tab\there\x00.txt", "tab_here_.txt"},
		{"folder/", "download"},
		{`x";filename=evil.exe;a="`, `x";filename=evil.exe;a="`},
	}
	for _, c := range cases {
		res := browseOne(t, c.key, "dl=1", []byte("data"), "text/plain")
		cd := res.Header().Get("Content-Disposition")
		if strings.ContainsAny(cd, "\r\n\x00") {
			t.Errorf("%q: control character in header %q", c.key, cd)
		}
		typ, params, err := mime.ParseMediaType(cd)
		if err != nil || typ != "attachment" {
			t.Errorf("%q: header %q does not parse: %v", c.key, cd, err)
			continue
		}
		if params["filename"] != c.wantName {
			t.Errorf("%q: filename = %q, want %q (header %q)", c.key, params["filename"], c.wantName, cd)
		}
		if len(params) > 2 || (len(params) == 2 && params["filename"] == "") {
			t.Errorf("%q: unexpected parameters %v in %q", c.key, params, cd)
		}
		for i := 0; i < len(cd); i++ {
			if cd[i] >= 0x7f {
				t.Errorf("%q: non-ASCII byte in header %q", c.key, cd)
				break
			}
		}
	}
}

// A non-ASCII name carries an ASCII fallback and the RFC 5987 form, so every client gets the real name.
func TestDownloadFilenameHasASCIIFallbackAndExtended(t *testing.T) {
	cd := browseOne(t, "d/日本語 ü.txt", "dl=1", []byte("x"), "text/plain").Header().Get("Content-Disposition")
	if !strings.Contains(cd, `filename="`) || !strings.Contains(cd, "filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E%20%C3%BC.txt") {
		t.Fatalf("Content-Disposition = %q", cd)
	}
	_, params, err := mime.ParseMediaType(cd)
	if err != nil || params["filename"] != "日本語 ü.txt" {
		t.Fatalf("parsed %v, %v", params, err)
	}
}

func TestObjectResponsesAreNotCached(t *testing.T) {
	for _, query := range []string{"view=1", "dl=1"} {
		res := browseOne(t, "a.txt", query, []byte("data"), "text/plain")
		if res.Header().Get("Cache-Control") != "no-store" {
			t.Errorf("%s: Cache-Control = %q", query, res.Header().Get("Cache-Control"))
		}
		if !strings.Contains(res.Header().Get("Content-Security-Policy"), "sandbox") {
			t.Errorf("%s: sandbox CSP lost", query)
		}
	}
	var img bytes.Buffer
	if err := png.Encode(&img, image.NewRGBA(image.Rect(0, 0, 8, 8))); err != nil {
		t.Fatal(err)
	}
	res := browseOne(t, "a.png", "thumb=1", img.Bytes(), "image/png")
	if res.Code != 200 || res.Header().Get("Content-Type") != "image/jpeg" {
		t.Fatalf("thumbnail: %d %s", res.Code, res.Header().Get("Content-Type"))
	}
	if res.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("thumbnail: Cache-Control = %q", res.Header().Get("Cache-Control"))
	}
	if !strings.Contains(res.Header().Get("Content-Security-Policy"), "sandbox") {
		t.Error("thumbnail: sandbox CSP lost")
	}
}
