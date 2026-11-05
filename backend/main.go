package main

import (
	"context"
	"khairul169/garage-webui/router"
	"khairul169/garage-webui/ui"
	"khairul169/garage-webui/utils"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/alexedwards/scs/v2"
	"github.com/joho/godotenv"
)

// healthAddr is where the healthcheck dials: HOST when it names a concrete address, loopback when
// HOST is unset or a wildcard (0.0.0.0, ::), which the server answers on loopback too.
func healthAddr(host, port string) string {
	if ip := net.ParseIP(host); host == "" || (ip != nil && ip.IsUnspecified()) {
		host = "127.0.0.1"
	}
	return net.JoinHostPort(host, port)
}

// healthy reports whether the server at addr answers its /healthz with 204.
func healthy(addr, basePath string) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	res, err := client.Get("http://" + addr + basePath + "/healthz")
	if err != nil {
		return false
	}
	res.Body.Close()
	return res.StatusCode == http.StatusNoContent
}

// newHandler wires the application: health probe, API, UI, base-path redirect, then the global
// security headers and the session layer around all of it.
func newHandler(auth *router.Auth, sessionMgr *scs.SessionManager, basePath, publicURL string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+basePath+"/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	ui.ServeUI(mux)
	if basePath != "" {
		mux.Handle("/", http.RedirectHandler(basePath+"/", http.StatusMovedPermanently))
	}
	// ServeMux redirects a path with dot segments or doubled slashes to its cleaned form before any
	// handler runs, which would hide an unclean API path from the API's own probe guard. The API
	// prefix is therefore routed here, on the raw path, ahead of the mux.
	apiPrefix := basePath + "/api"
	api := http.StripPrefix(apiPrefix, router.HandleApiRouter(auth))
	root := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, apiPrefix+"/") {
			api.ServeHTTP(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	})
	return sessionMgr.LoadAndSave(securityHeaders(root, publicURL))
}

func main() {
	godotenv.Load()
	host, port, basePath := utils.GetEnv("HOST", "0.0.0.0"), utils.GetEnv("PORT", "3909"), os.Getenv("BASE_PATH")
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		if !healthy(healthAddr(host, port), basePath) {
			os.Exit(1)
		}
		return
	}
	auth, err := router.NewAuth(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	if err := router.LoadUploadLimit(); err != nil {
		log.Fatal(err)
	}
	utils.InitCacheManager()
	sessionMgr := utils.InitSessionManager()
	if err := utils.Garage.LoadConfig(); err != nil && (os.Getenv("API_BASE_URL") == "" || os.Getenv("API_ADMIN_KEY") == "") {
		log.Fatal("Garage configuration unavailable; provide API_BASE_URL and API_ADMIN_KEY or CONFIG_PATH")
	}
	if utils.Garage.GetAdminKey() == "" {
		log.Fatal("Garage admin API key is required")
	}
	server := &http.Server{
		Addr:              net.JoinHostPort(host, port),
		Handler:           newHandler(auth, sessionMgr, basePath, os.Getenv("PUBLIC_URL")),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	stop, done := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer done()
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-stop.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Print("HTTP shutdown failed")
		}
	}()
	log.Printf("Starting Garage WebUI on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
	<-shutdownDone
}
