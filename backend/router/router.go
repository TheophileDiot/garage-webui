package router

import (
	"io"
	"khairul169/garage-webui/middleware"
	"khairul169/garage-webui/utils"
	"net/http"
	"os"
	"path"
	"strings"
	"time"
)

func HandleApiRouter(auth *Auth) http.Handler {
	// Audit lines go to stdout, one JSON object per line; the application log stays on stderr.
	audit := &middleware.Auditor{
		Out:   func() io.Writer { return os.Stdout },
		Actor: func(r *http.Request) utils.Actor { return utils.Session.Actor(r) },
		Now:   time.Now,
	}
	mux := http.NewServeMux()
	mux.Handle("POST /auth/login", audit.Wrap(http.HandlerFunc(auth.Login)))
	mux.HandleFunc("GET /auth/status", auth.GetStatus)
	mux.HandleFunc("GET /auth/oidc/login", auth.OIDCLogin)
	mux.Handle("GET /auth/oidc/callback", audit.Wrap(http.HandlerFunc(auth.OIDCCallback)))

	protected := http.NewServeMux()
	protected.HandleFunc("POST /auth/logout", auth.Logout)
	config := &Config{}
	protected.HandleFunc("GET /config", config.GetAll)
	buckets := &Buckets{}
	protected.HandleFunc("GET /buckets", buckets.GetAll)
	browse := &Browse{}
	protected.HandleFunc("GET /browse/{bucket}", browse.GetObjects)
	protected.HandleFunc("GET /browse/{bucket}/{key...}", browse.GetOneObject)
	protected.HandleFunc("PUT /browse/{bucket}/{key...}", browse.PutObject)
	protected.HandleFunc("DELETE /browse/{bucket}/{key...}", browse.DeleteObject)
	protected.HandleFunc("/", ProxyHandler)
	authenticated := func(next http.Handler) http.Handler {
		return middleware.AuthMiddleware(auth.Authenticated, audit.Wrap(next))
	}
	mux.Handle("/", authenticated(protected))

	// ServeMux answers a path with dot segments or doubled slashes by redirecting to the cleaned
	// path. Outside the app's own routes such a request can only be a probe of the admin proxy,
	// so it goes there and gets the same 403, and the audit line, as any unlisted operation.
	probe := authenticated(http.HandlerFunc(ProxyHandler))
	return middleware.SameOrigin(auth.origin, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.EscapedPath()
		if !isClean(p) && !strings.HasPrefix(p, "/browse/") && !strings.HasPrefix(p, "/auth/") {
			probe.ServeHTTP(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	}))
}

// isClean reports whether ServeMux would serve p without redirecting it.
func isClean(p string) bool {
	if p == "" {
		return true
	}
	cleaned := path.Clean(p)
	return cleaned == p || cleaned+"/" == p
}
