//go:build prod
// +build prod

package ui

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
)

//go:embed dist
var embeddedFs embed.FS

func ServeUI(mux *http.ServeMux) {
	distFs, _ := fs.Sub(embeddedFs, "dist")
	basePath := os.Getenv("BASE_PATH")
	mux.Handle(basePath+"/", newHandler(distFs, basePath))
}
