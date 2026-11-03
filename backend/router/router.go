package router

import (
	"khairul169/garage-webui/middleware"
	"net/http"
)

func HandleApiRouter(auth *Auth) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /auth/login", auth.Login)
	mux.HandleFunc("GET /auth/status", auth.GetStatus)
	mux.HandleFunc("GET /auth/oidc/login", auth.OIDCLogin)
	mux.HandleFunc("GET /auth/oidc/callback", auth.OIDCCallback)

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
	mux.Handle("/", middleware.AuthMiddleware(protected))
	return middleware.SameOrigin(auth.origin, mux)
}
