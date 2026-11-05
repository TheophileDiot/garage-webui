package router

import (
	"encoding/json"
	"errors"
	"io"
	"khairul169/garage-webui/utils"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type Auth struct {
	oidc     *oidcAuth
	origin   string
	basePath string
	// Local password sign-in, validated once by NewAuth; empty under OIDC.
	localUser, localHash string
}

// local reports whether password sign-in is the configured mode.
func (c *Auth) local() bool { return c.oidc == nil && c.localUser != "" }

func (c *Auth) Login(w http.ResponseWriter, r *http.Request) {
	if !c.local() {
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
	passwordErr := bcrypt.CompareHashAndPassword([]byte(c.localHash), []byte(body.Password))
	if body.Username != c.localUser || passwordErr != nil {
		utils.ResponseErrorStatus(w, errors.New("invalid username or password"), http.StatusUnauthorized)
		return
	}
	if err := utils.Session.Authenticate(r, utils.Actor{Kind: "local", Subject: c.localUser, Name: c.localUser}, time.Now().Add(8*time.Hour)); err != nil {
		http.Error(w, "could not start session", http.StatusInternalServerError)
		return
	}
	utils.ResponseSuccess(w, map[string]bool{"authenticated": true})
}

func (c *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	grantID, _ := utils.Session.Get(r, "oidc_grant").(string)
	if err := utils.Session.Destroy(r); err != nil {
		http.Error(w, "could not end session", http.StatusInternalServerError)
		return
	}
	if c.oidc != nil {
		c.oidc.endGrant(r.Context(), grantID, true)
	}
	utils.ResponseSuccess(w, true)
}

func (c *Auth) GetStatus(w http.ResponseWriter, r *http.Request) {
	authenticated := c.Authenticated(r)
	status := map[string]interface{}{
		"enabled":       true,
		"authenticated": authenticated,
		"local":         c.local(),
		"oidc":          c.oidc != nil,
	}
	if authenticated {
		status["displayName"] = utils.Session.Get(r, "display_name")
	}
	w.Header().Set("Cache-Control", "no-store")
	utils.ResponseSuccess(w, status)
}
