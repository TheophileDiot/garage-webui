package ui

import (
	"strings"
	"testing"
)

// Under a base path the served document and the JS and CSS bundles are rewritten; nothing else is.
func TestBasePathRewriting(t *testing.T) {
	h := newHandler(testFS(), "/garage")

	js := get(h, "/garage/assets/index-abc.js")
	if js.Code != 200 || js.Header().Get("Content-Type") != "text/javascript" || js.Body.String() != `import("garage/assets/chunk.js")` {
		t.Fatalf("js: %d %q %q", js.Code, js.Header().Get("Content-Type"), js.Body.String())
	}
	css := get(h, "/garage/assets/index-abc.css")
	if css.Code != 200 || css.Header().Get("Content-Type") != "text/css" || css.Body.String() != `body{background:url(garage/assets/x.png)}` {
		t.Fatalf("css: %d %q %q", css.Code, css.Header().Get("Content-Type"), css.Body.String())
	}
	if png := get(h, "/garage/favicon-32x32.png"); png.Body.String() != "png" {
		t.Fatalf("binary asset changed: %q", png.Body.String())
	}

	doc := get(h, "/garage/buckets").Body.String()
	for _, want := range []string{`href="/garage/favicon-32x32.png"`, `src="/garage/assets/index-abc.js"`, `href="/garage/assets/index-abc.css"`, `window.__BASE_PATH = "/garage";`} {
		if !strings.Contains(doc, want) {
			t.Errorf("document lacks %s:\n%s", want, doc)
		}
	}
	root := newHandler(testFS(), "")
	if doc := get(root, "/buckets").Body.String(); !strings.Contains(doc, `href="/favicon-32x32.png"`) || !strings.Contains(doc, `window.__BASE_PATH = "";`) {
		t.Errorf("unprefixed document changed:\n%s", doc)
	}
}
