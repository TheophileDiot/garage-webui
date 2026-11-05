package router

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

var (
	v2Literal = regexp.MustCompile("[\"'`](/v2/[^\"'`\\s]*)")
	apiCall   = regexp.MustCompile("\\bapi\\.(get|post|put|delete|patch)(?:<[^()]*>)?\\(\\s*[\"'`]([^\"'`]*)")
	appRoutes = []string{"/config", "/buckets", "/browse/", "/auth/"}
)

type uiCall struct{ method, path, file string }

// scanUI returns every literal admin path in the frontend with the verb of the api.<verb>() call
// that uses it, plus the calls it cannot vouch for.
func scanUI(t *testing.T) (calls []uiCall, problems []string) {
	t.Helper()
	root := filepath.Join("..", "..", "src")
	if _, err := os.Stat(root); err != nil {
		t.Skipf("frontend sources not found at %s: %v", root, err)
	}
	err := filepath.WalkDir(root, func(file string, d fs.DirEntry, err error) error {
		name := d.Name()
		if err != nil || d.IsDir() || !(strings.HasSuffix(name, ".ts") || strings.HasSuffix(name, ".tsx")) || strings.Contains(name, ".test.") || strings.HasSuffix(name, ".d.ts") {
			return err
		}
		data, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		src, file := string(data), filepath.ToSlash(file)
		verbAt := map[int]string{} // offset of the opening quote of an api call's first argument
		for _, m := range apiCall.FindAllStringSubmatchIndex(src, -1) {
			verbAt[m[4]-1] = strings.ToUpper(src[m[2]:m[3]])
			arg := src[m[4]:m[5]]
			known := strings.HasPrefix(arg, "/v2/")
			for _, prefix := range appRoutes {
				known = known || strings.HasPrefix(arg, prefix)
			}
			if !known {
				problems = append(problems, arg+" ("+file+") is neither an app route nor an admin path: it would reach the admin proxy and get 403")
			}
		}
		for _, m := range v2Literal.FindAllStringSubmatchIndex(src, -1) {
			literal := src[m[2]:m[3]]
			if verb := verbAt[m[2]-1]; verb != "" {
				calls = append(calls, uiCall{verb, literal, file})
			} else {
				problems = append(problems, literal+" ("+file+") is not the first argument of api.get/post/put/delete, so its method cannot be checked")
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return calls, problems
}

func TestAllowListCoversEveryUIAdminCall(t *testing.T) {
	data, err := os.ReadFile("admin_ops.json")
	if err != nil {
		t.Fatal(err)
	}
	var list struct {
		Operations []struct{ Name, Method, Path string }
	}
	if err := json.Unmarshal(data, &list); err != nil || len(list.Operations) == 0 {
		t.Fatalf("admin_ops.json: %v", err)
	}
	allowed := map[string]string{} // path -> method
	for _, op := range list.Operations {
		allowed[op.Path] = op.Method
	}
	calls, problems := scanUI(t)
	if len(calls) < len(uiOperations) {
		t.Fatalf("scan found only %d admin calls; the pattern no longer matches the UI code", len(calls))
	}
	used := map[string]bool{}
	for _, c := range calls {
		used[c.path] = true
		if method, ok := allowed[c.path]; !ok {
			problems = append(problems, c.method+" "+c.path+" ("+c.file+") is missing from admin_ops.json; the proxy would answer 403")
		} else if method != c.method {
			problems = append(problems, c.method+" "+c.path+" ("+c.file+") is listed as "+method+" in admin_ops.json")
		}
	}
	for path := range allowed {
		if !used[path] {
			problems = append(problems, path+" is in admin_ops.json but no UI code calls it; remove it to keep the proxy minimal")
		}
	}
	sort.Strings(problems)
	for _, p := range problems {
		t.Error(p)
	}
}
