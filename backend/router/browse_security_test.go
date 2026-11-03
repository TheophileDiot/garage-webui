package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"khairul169/garage-webui/utils"
)

func TestObjectViewsAreSandboxed(t *testing.T) {
	f := newOIDCFixture(t, "")
	cookie, params := f.start(t)
	login := request(f.handler, "GET", "/auth/oidc/callback?code=test&state="+params.Get("state"), cookie)
	cookie = login.Result().Cookies()[0]
	garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v2/GetBucketInfo":
			w.Write([]byte(`{"keys":[{"accessKeyId":"test-key","permissions":{"read":true,"write":true}}]}`))
		case "/v2/GetKeyInfo":
			w.Write([]byte(`{"accessKeyId":"test-key","secretAccessKey":"test-secret"}`))
		case "/test/index.html":
			w.Header().Set("Content-Type", "text/html")
			w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
			w.Write([]byte("<script>alert(document.cookie)</script>"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer garage.Close()
	t.Setenv("API_BASE_URL", garage.URL)
	t.Setenv("S3_ENDPOINT_URL", garage.URL)
	t.Setenv("API_ADMIN_KEY", "test-admin")
	utils.InitCacheManager()
	res := request(f.handler, "GET", "/browse/test/index.html?view=1", cookie)
	if res.Code != 200 || !strings.Contains(res.Body.String(), "<script>") {
		t.Fatalf("object view: %d %s", res.Code, res.Body.String())
	}
	if !strings.Contains(res.Header().Get("Content-Security-Policy"), "sandbox") {
		t.Fatal("untrusted object can execute scripts with admin origin")
	}
	if res.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("object view can remain cached after sign-out")
	}
}

func TestListedObjectURLsPreserveReservedCharacters(t *testing.T) {
	garage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/GetBucketInfo":
			w.Write([]byte(`{"keys":[{"accessKeyId":"test-key","permissions":{"read":true,"write":true}}]}`))
		case "/v2/GetKeyInfo":
			w.Write([]byte(`{"accessKeyId":"test-key","secretAccessKey":"test-secret"}`))
		case "/test":
			w.Header().Set("Content-Type", "application/xml")
			w.Write([]byte(`<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Contents><Key>folder/reserved-#question?%.txt</Key><Size>3</Size></Contents></ListBucketResult>`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer garage.Close()
	t.Setenv("API_BASE_URL", garage.URL)
	t.Setenv("S3_ENDPOINT_URL", garage.URL)
	t.Setenv("API_ADMIN_KEY", "test-admin")
	utils.InitCacheManager()
	req := httptest.NewRequest("GET", "/browse/test", nil)
	req.SetPathValue("bucket", "test")
	res := httptest.NewRecorder()
	(&Browse{}).GetObjects(res, req)
	var body struct {
		Objects []struct {
			URL string `json:"url"`
		} `json:"objects"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || len(body.Objects) != 1 {
		t.Fatalf("list response: %d %s", res.Code, res.Body.String())
	}
	objectURL, err := url.Parse(body.Objects[0].URL)
	if err != nil || objectURL.RawQuery != "" || objectURL.Fragment != "" || objectURL.Path != "/browse/test/folder/reserved-#question?%.txt" {
		t.Fatalf("object key changed in URL: %s", body.Objects[0].URL)
	}
}
