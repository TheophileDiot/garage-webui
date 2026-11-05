package middleware

import (
	"errors"
	"khairul169/garage-webui/utils"
	"net/http"
)

// authenticated may refresh the session, so it takes the request rather than reading the cookie alone.
func AuthMiddleware(authenticated func(*http.Request) bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !authenticated(r) {
			utils.ResponseErrorStatus(w, errors.New("unauthorized"), http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Browser mutations require the configured origin or a non-simple request header.
func SameOrigin(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
		default:
			requestOrigin := r.Header.Get("Origin")
			if (requestOrigin != "" && requestOrigin != origin) || (requestOrigin == "" && r.Header.Get("X-Requested-With") != "garage-webui") {
				http.Error(w, "request origin rejected", http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
