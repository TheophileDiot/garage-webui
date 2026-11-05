package ui

import (
	"crypto/sha256"
	"encoding/base64"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"regexp"
	"strings"
)

// Go has no built-in type for .webmanifest and the scratch image ships no mime database.
func init() { mime.AddExtensionType(".webmanifest", "application/manifest+json") }

// inlineScript matches a <script> element without a src attribute, which only runs if its text is allowed by hash.
var inlineScript = regexp.MustCompile(`(?is)<script(?:\s[^>]*)?>(.*?)</script>`)

var scriptWithSrc = regexp.MustCompile(`(?is)^<script\s[^>]*\bsrc\s*=`)

// rootRelativeRef matches an href or src attribute that points at a root-relative path.
var rootRelativeRef = regexp.MustCompile(`(href|src)=["'](/[^"'>]+)["']`)

// contentSecurityPolicy builds the policy of the application HTML. Inline scripts are allowed by the
// SHA-256 of their exact text in html, the document as served, so it cannot drift from index.html.
func contentSecurityPolicy(html string) string {
	scriptSrc := "script-src 'self'"
	for _, m := range inlineScript.FindAllStringSubmatch(html, -1) {
		if scriptWithSrc.MatchString(m[0]) {
			continue
		}
		sum := sha256.Sum256([]byte(m[1]))
		scriptSrc += " 'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
	}
	// style-src keeps 'unsafe-inline' for one reason: sonner (toast CSS) and react-style-singleton (the
	// Radix dialog scroll lock) append a <style> element at runtime whose text lives in the JS bundle, not
	// in index.html, and neither takes a nonce here. Scripts stay hash-only, so this cannot run code.
	return "default-src 'self'; " + scriptSrc + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; " +
		"connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
}

// newHandler serves the built console from distFs under basePath.
func newHandler(distFs fs.FS, basePath string) http.Handler {
	fileServer := http.FileServer(http.FS(distFs))

	// The document is the same for every route, so it and its policy are built once.
	index, _ := fs.ReadFile(distFs, "index.html")
	html := string(index)
	html = strings.ReplaceAll(html, "%BASE_PATH%", basePath)
	html = addBasePath(html, basePath)
	policy := contentSecurityPolicy(html)

	return http.StripPrefix(basePath, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := path.Clean(r.URL.Path)[1:]

		if _, err := fs.Stat(distFs, name); err != nil {
			// A missing bundle file is a stale or mistyped chunk, not a route: HTML there is a MIME error.
			if strings.HasPrefix(name, "assets/") {
				http.NotFound(w, r)
				return
			}
			// Rewrite non-existing paths to index.html
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Content-Security-Policy", policy)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(html))
			return
		}

		if len(basePath) > 0 && (strings.HasSuffix(name, ".js") || strings.HasSuffix(name, ".css")) {
			serveRewrittenAsset(w, distFs, name, basePath)
			return
		}

		fileServer.ServeHTTP(w, r)
	}))
}

// serveRewrittenAsset serves a JS or CSS bundle with every assets/ reference moved under basePath.
func serveRewrittenAsset(w http.ResponseWriter, distFs fs.FS, name, basePath string) {
	data, _ := fs.ReadFile(distFs, name)
	body := strings.ReplaceAll(string(data), "assets/", basePath[1:]+"/assets/")

	contentType := "text/javascript"
	if strings.HasSuffix(name, ".css") {
		contentType = "text/css"
	}
	w.Header().Add("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(body))
}

func addBasePath(html string, basePath string) string {
	return rootRelativeRef.ReplaceAllStringFunc(html, func(match string) string {
		return rootRelativeRef.ReplaceAllString(match, `$1="`+basePath+`$2"`)
	})
}
