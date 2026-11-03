package router

import (
	"encoding/json"
	"errors"
	"io"
	"khairul169/garage-webui/utils"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type Auth struct {
	oidc     *oidcAuth
	origin   string
	basePath string
}

func (c *Auth) Login(w http.ResponseWriter, r *http.Request) {
	if c.oidc != nil || os.Getenv("AUTH_USER_PASS") == "" {
		http.Error(w, "password sign-in is disabled", http.StatusForbidden)
		return
	}
	var body struct {
		Username string
		Password string
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	decoder := json.NewDecoder(r.Body)
	if decoder.Decode(&body) != nil || decoder.Decode(&struct{}{}) != io.EOF {
		http.Error(w, "invalid sign-in request", http.StatusBadRequest)
		return
	}
	username, hash, _ := strings.Cut(os.Getenv("AUTH_USER_PASS"), ":")
	passwordErr := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password))
	if body.Username != username || passwordErr != nil {
		utils.ResponseErrorStatus(w, errors.New("invalid username or password"), http.StatusUnauthorized)
		return
	}
	if err := utils.Session.Authenticate(r, username, time.Now().Add(8*time.Hour)); err != nil {
		http.Error(w, "could not start session", http.StatusInternalServerError)
		return
	}
	utils.ResponseSuccess(w, map[string]bool{"authenticated": true})
}

func (c *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	if err := utils.Session.Destroy(r); err != nil {
		http.Error(w, "could not end session", http.StatusInternalServerError)
		return
	}
	utils.ResponseSuccess(w, true)
}

func (c *Auth) GetStatus(w http.ResponseWriter, r *http.Request) {
	authenticated := utils.Session.Authenticated(r)
	status := map[string]interface{}{
		"enabled":       true,
		"authenticated": authenticated,
		"local":         c.oidc == nil && os.Getenv("AUTH_USER_PASS") != "",
		"oidc":          c.oidc != nil,
	}
	if authenticated {
		status["displayName"] = utils.Session.Get(r, "display_name")
	}
	w.Header().Set("Cache-Control", "no-store")
	utils.ResponseSuccess(w, status)
}
