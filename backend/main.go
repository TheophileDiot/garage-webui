package main

import (
	"context"
	"fmt"
	"khairul169/garage-webui/router"
	"khairul169/garage-webui/ui"
	"khairul169/garage-webui/utils"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	port := utils.GetEnv("PORT", "3909")
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		client := &http.Client{Timeout: 2 * time.Second}
		res, err := client.Get("http://127.0.0.1:" + port + os.Getenv("BASE_PATH") + "/healthz")
		if err != nil {
			os.Exit(1)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusNoContent {
			os.Exit(1)
		}
		return
	}
	auth, err := router.NewAuth(context.Background())
	if err != nil {
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
	basePath := os.Getenv("BASE_PATH")
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+basePath+"/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	apiPrefix := basePath + "/api"
	mux.Handle(apiPrefix+"/", http.StripPrefix(apiPrefix, router.HandleApiRouter(auth)))
	ui.ServeUI(mux)
	if basePath != "" {
		mux.Handle("/", http.RedirectHandler(basePath+"/", http.StatusMovedPermanently))
	}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		mux.ServeHTTP(w, r)
	})
	server := &http.Server{
		Addr:              fmt.Sprintf("%s:%s", utils.GetEnv("HOST", "0.0.0.0"), port),
		Handler:           sessionMgr.LoadAndSave(handler),
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
