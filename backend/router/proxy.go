package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/middleware"
	"khairul169/garage-webui/utils"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

// Query parameters that name the object an admin operation acts on; they go to the audit log.
var auditQueryTargets = []string{"id", "search", "globalAlias", "node"}

// ProxyHandler forwards the admin operations listed in admin_ops.json to Garage with the admin
// token, and refuses everything else without contacting Garage. Garage only ever receives the
// listed path, never a path derived from the client's request.
func ProxyHandler(w http.ResponseWriter, r *http.Request) {
	rec := middleware.Audit(r)
	op := allowedAdminOps.Match(r)
	if op == nil {
		if rec != nil {
			rec.Operation, rec.Path = "unlisted", r.URL.Path
		}
		writeJSONError(w, http.StatusForbidden, "this Garage operation is not available through the console")
		return
	}
	query := r.URL.Query()
	if rec != nil {
		rec.Operation, rec.Target = op.Name, map[string]string{}
		for _, key := range auditQueryTargets {
			rec.Target[key] = query.Get(key)
		}
		rec.SecretReveal = op.Name == "GetKeyInfo" && revealsSecret(query)
	}

	target, err := url.Parse(utils.Garage.GetAdminEndpoint())
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	proxy := &httputil.ReverseProxy{
		Transport: utils.AdminTransport,
		Rewrite: func(r *httputil.ProxyRequest) {
			r.SetURL(target)
			r.Out.URL.Path, r.Out.URL.RawPath = op.Path, ""
			r.Out.Header.Del("Cookie")
			r.Out.Header.Del("Authorization")
			r.Out.Header.Set("Authorization", fmt.Sprintf("Bearer %s", utils.Garage.GetAdminKey()))
		},
		// The console is same-origin: Garage's own CORS headers (Allow-Origin: *) must not reach the browser.
		ModifyResponse: func(res *http.Response) error {
			for name := range res.Header {
				if strings.HasPrefix(strings.ToLower(name), "access-control-") {
					res.Header.Del(name)
				}
			}
			return nil
		},
	}

	proxy.ServeHTTP(w, r)
}

// revealsSecret is true when showSecretKey is set to anything but false, so an unusual spelling
// Garage might accept is audited rather than missed.
func revealsSecret(query url.Values) bool {
	for _, v := range query["showSecretKey"] {
		if v != "" && !strings.EqualFold(v, "false") {
			return true
		}
	}
	return false
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"code": http.StatusText(status), "message": message})
}
