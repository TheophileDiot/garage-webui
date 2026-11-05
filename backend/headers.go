package main

import (
	"net/http"
	"strings"
)

// permissionsPolicy turns off the browser features the console never uses.
const permissionsPolicy = "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"

// securityHeaders wraps next with the headers every response carries. The Content-Security-Policy set
// here is the policy for everything that is not a document (the API's JSON, errors, redirects); the UI
// handler replaces it for the application HTML and the object route for stored files.
func securityHeaders(next http.Handler, publicURL string) http.Handler {
	// HSTS is only valid over https, and a plain-http deployment must not pin browsers to https.
	hsts := strings.HasPrefix(strings.ToLower(publicURL), "https://")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "same-origin")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		h.Set("Cross-Origin-Resource-Policy", "same-origin")
		h.Set("Permissions-Policy", permissionsPolicy)
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		if hsts {
			h.Set("Strict-Transport-Security", "max-age=31536000")
		}
		next.ServeHTTP(w, r)
	})
}
