package ui

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"testing/fstest"
)

const themeScript = `
      window.__BASE_PATH = "%BASE_PATH%";
      (function () { document.documentElement.setAttribute("data-theme", "dark"); })();
    `

const otherScript = `window.second = 1;`

var testIndex = `<!doctype html><html><head>
<link rel="icon" href="/favicon-32x32.png" />
<script>` + themeScript + `</script>
<script>` + otherScript + `</script>
<script type="module" crossorigin src="/assets/index-abc.js"></script>
<link rel="stylesheet" href="/assets/index-abc.css">
</head><body><div id="root"></div></body></html>`

func testFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":           {Data: []byte(testIndex)},
		"assets/index-abc.js":  {Data: []byte(`import("assets/chunk.js")`)},
		"assets/index-abc.css": {Data: []byte(`body{background:url(assets/x.png)}`)},
		"favicon-32x32.png":    {Data: []byte("png")},
	}
}

func get(h http.Handler, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", target, nil))
	return rec
}

func sha(s string) string {
	sum := sha256.Sum256([]byte(s))
	return "'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
}

func directive(csp, name string) string {
	for _, d := range strings.Split(csp, ";") {
		d = strings.TrimSpace(d)
		if d == name || strings.HasPrefix(d, name+" ") {
			return d
		}
	}
	return ""
}

func TestIndexCarriesStrictCSP(t *testing.T) {
	for _, base := range []string{"", "/garage"} {
		h := newHandler(testFS(), base)
		for _, target := range []string{base + "/", base + "/buckets/some/deep/route"} {
			rec := get(h, target)
			if rec.Code != 200 {
				t.Fatalf("%s: status %d", target, rec.Code)
			}
			csp := rec.Header().Get("Content-Security-Policy")
			if csp == "" {
				t.Fatalf("%s: no Content-Security-Policy on the application HTML", target)
			}
			for _, want := range []string{
				"default-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'",
				"connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
			} {
				if !strings.Contains(csp, want) {
					t.Errorf("%s: CSP lacks %q: %s", target, want, csp)
				}
			}
			if strings.Contains(directive(csp, "script-src"), "unsafe") {
				t.Errorf("%s: script-src must not be relaxed: %s", target, csp)
			}
			if got := rec.Header().Get("Content-Type"); got != "text/html; charset=utf-8" {
				t.Errorf("%s: Content-Type %q", target, got)
			}
		}
	}
}

// The hashes must be those of the inline scripts as served, after %BASE_PATH% was replaced.
func TestScriptHashesMatchServedInlineScripts(t *testing.T) {
	for _, base := range []string{"", "/garage"} {
		rec := get(newHandler(testFS(), base), base+"/")
		scripts := regexp.MustCompile(`(?s)<script>(.*?)</script>`).FindAllStringSubmatch(rec.Body.String(), -1)
		if len(scripts) != 2 {
			t.Fatalf("base %q: expected 2 inline scripts in the served HTML, got %d", base, len(scripts))
		}
		scriptSrc := directive(rec.Header().Get("Content-Security-Policy"), "script-src")
		for _, s := range scripts {
			if !strings.Contains(scriptSrc, sha(s[1])) {
				t.Errorf("base %q: script-src lacks the hash of the served script %q: %s", base, s[1], scriptSrc)
			}
		}
		if base != "" && !strings.Contains(scripts[0][1], `"/garage"`) {
			t.Fatalf("base path not rewritten in the served script: %s", scripts[0][1])
		}
		// The hash of the template text (before the rewrite) would be a stale hash.
		if base != "" && strings.Contains(scriptSrc, sha(themeScript)) {
			t.Errorf("script-src carries the hash of the unrewritten script: %s", scriptSrc)
		}
		if got := strings.Count(scriptSrc, "'sha256-"); got != 2 {
			t.Errorf("base %q: want 2 hashes, got %d: %s", base, got, scriptSrc)
		}
	}
}

// A changed index.html must change the policy: nothing is hard-coded.
func TestHashesFollowIndexHTML(t *testing.T) {
	fsys := testFS()
	fsys["index.html"] = &fstest.MapFile{Data: []byte(`<html><head><script>alert(1)</script></head></html>`)}
	scriptSrc := directive(get(newHandler(fsys, ""), "/").Header().Get("Content-Security-Policy"), "script-src")
	if !strings.Contains(scriptSrc, sha("alert(1)")) || strings.Count(scriptSrc, "'sha256-") != 1 {
		t.Fatalf("script-src does not follow the served HTML: %s", scriptSrc)
	}
}

func TestStaticAssetsKeepTheirContent(t *testing.T) {
	rec := get(newHandler(testFS(), ""), "/assets/index-abc.js")
	if rec.Code != 200 || rec.Body.String() != `import("assets/chunk.js")` {
		t.Fatalf("asset: %d %q", rec.Code, rec.Body.String())
	}
	rec = get(newHandler(testFS(), "/garage"), "/garage/assets/index-abc.js")
	if !strings.Contains(rec.Body.String(), "garage/assets/chunk.js") {
		t.Fatalf("base path not applied to the asset: %q", rec.Body.String())
	}
	if rec.Header().Get("Content-Security-Policy") != "" {
		t.Fatal("a script asset needs no document policy")
	}
}

// A miss under assets/ is a stale or mistyped chunk, not a route: answering it with the HTML page
// makes the browser fail on a MIME error instead of a clear 404.
func TestMissingAssetsAre404(t *testing.T) {
	for _, base := range []string{"", "/garage"} {
		h := newHandler(testFS(), base)
		for _, target := range []string{
			base + "/assets/does-not-exist.js",
			base + "/assets/sub/dir/gone.css",
		} {
			rec := get(h, target)
			if rec.Code != http.StatusNotFound {
				t.Errorf("%s: status %d, want 404", target, rec.Code)
			}
			if strings.Contains(strings.ToLower(rec.Body.String()), "<html") || strings.Contains(rec.Body.String(), `id="root"`) {
				t.Errorf("%s: 404 carries the application HTML: %q", target, rec.Body.String())
			}
			if got := rec.Header().Get("Content-Type"); strings.HasPrefix(got, "text/html") {
				t.Errorf("%s: Content-Type %q", target, got)
			}
			if rec.Header().Get("Content-Security-Policy") != "" {
				t.Errorf("%s: a 404 needs no application policy", target)
			}
		}
	}
}

// Anything else that is unknown is a client-side route: it keeps the SPA fallback.
func TestUnknownPathsKeepSPAFallback(t *testing.T) {
	for _, base := range []string{"", "/garage"} {
		h := newHandler(testFS(), base)
		for _, target := range []string{
			base + "/buckets/some/deep/route",
			base + "/keys",
			base + "/assetsfoo",
			base + "/other/assets/x.js",
		} {
			rec := get(h, target)
			if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `id="root"`) {
				t.Errorf("%s: %d, want the app HTML with 200", target, rec.Code)
			}
			if !strings.Contains(rec.Header().Get("Content-Security-Policy"), "script-src 'self'") {
				t.Errorf("%s: no application CSP", target)
			}
		}
	}
}
