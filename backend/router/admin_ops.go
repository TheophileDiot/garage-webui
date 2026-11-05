package router

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// admin_ops.json is the single source of truth for what the proxy forwards to the Garage admin
// API: one entry per operation the UI calls. To add a feature, add its operation here; a test
// scans the frontend and fails when a UI call is missing from the file.
//
// Roles come later: add a `roles` array to each entry and a field to adminOp, then check it in
// ProxyHandler after Match returns the entry.
//
//go:embed admin_ops.json
var adminOpsJSON []byte

type adminOp struct {
	Name   string `json:"name"`
	Method string `json:"method"`
	Path   string `json:"path"`
}

type adminOps struct {
	byRoute map[string]*adminOp // "METHOD /path" -> operation
}

var allowedAdminOps = mustLoadAdminOps(adminOpsJSON)

func mustLoadAdminOps(data []byte) *adminOps {
	ops, err := loadAdminOps(data)
	if err != nil {
		panic("admin_ops.json: " + err.Error())
	}
	return ops
}

func loadAdminOps(data []byte) (*adminOps, error) {
	var file struct {
		Operations []adminOp `json:"operations"`
	}
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, err
	}
	if len(file.Operations) == 0 {
		return nil, fmt.Errorf("no operations")
	}
	ops := &adminOps{byRoute: map[string]*adminOp{}}
	names := map[string]bool{}
	for i := range file.Operations {
		op := &file.Operations[i]
		switch op.Method {
		case http.MethodGet, http.MethodPost:
		default:
			return nil, fmt.Errorf("%q: method must be GET or POST, got %q", op.Name, op.Method)
		}
		// A path that is exactly "/v2/<name>": no query, dot segments, slashes or escapes.
		if op.Name == "" || strings.ContainsAny(op.Name, "/?#%.\\ ") || op.Path != "/v2/"+op.Name {
			return nil, fmt.Errorf("%q: path must be /v2/<name>, got %q", op.Name, op.Path)
		}
		if names[op.Name] {
			return nil, fmt.Errorf("%q listed twice", op.Name)
		}
		names[op.Name] = true
		ops.byRoute[op.Method+" "+op.Path] = op
	}
	return ops, nil
}

// Match returns the operation a request is for. The match is exact: the method as sent and the
// decoded path, with no escaped form (a request whose path was percent-encoded differently than
// Go would encode it, such as %2e%2e, %2F or %43, never matches), no trailing slash and no prefix.
func (o *adminOps) Match(r *http.Request) *adminOp {
	if r.URL.RawPath != "" || r.URL.Opaque != "" {
		return nil
	}
	return o.byRoute[r.Method+" "+r.URL.Path]
}
