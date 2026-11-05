package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"khairul169/garage-webui/schema"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/pelletier/go-toml/v2"
)

type garage struct {
	Config schema.Config
}

var Garage = &garage{}

// AdminTransport carries every call to the Garage admin API, the proxy's included. It bounds
// connecting and waiting for the reply headers, never the body: the proxy relays what Garage streams.
var AdminTransport = newAdminTransport()

func newAdminTransport() *http.Transport {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.DialContext = (&net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}).DialContext
	t.TLSHandshakeTimeout = 5 * time.Second
	t.ResponseHeaderTimeout = time.Minute
	return t
}

// adminClient is for Fetch, whose replies are small JSON documents, so a total timeout is safe.
var adminClient = &http.Client{Transport: AdminTransport, Timeout: 2 * time.Minute}

func (g *garage) LoadConfig() error {
	path := GetEnv("CONFIG_PATH", "/etc/garage.toml")
	data, err := os.ReadFile(path)

	if err != nil {
		return err
	}

	var cfg schema.Config
	err = toml.Unmarshal(data, &cfg)
	if err != nil {
		return err
	}

	g.Config = cfg

	return nil
}

func (g *garage) GetAdminEndpoint() string {
	endpoint := os.Getenv("API_BASE_URL")
	if len(endpoint) > 0 {
		return endpoint
	}

	host := strings.Split(g.Config.RPCPublicAddr, ":")[0]
	port := LastString(strings.Split(g.Config.Admin.APIBindAddr, ":"))

	endpoint = fmt.Sprintf("%s:%s", host, port)
	if !strings.HasPrefix(endpoint, "http") {
		endpoint = fmt.Sprintf("http://%s", endpoint)
	}

	return endpoint
}

func (g *garage) GetS3Endpoint() string {
	endpoint := os.Getenv("S3_ENDPOINT_URL")
	if len(endpoint) > 0 {
		return endpoint
	}

	host := strings.Split(g.Config.RPCPublicAddr, ":")[0]
	port := LastString(strings.Split(g.Config.S3API.APIBindAddr, ":"))

	endpoint = fmt.Sprintf("%s:%s", host, port)
	if !strings.HasPrefix(endpoint, "http") {
		endpoint = fmt.Sprintf("http://%s", endpoint)
	}

	return endpoint
}

func (g *garage) GetS3Region() string {
	endpoint := os.Getenv("S3_REGION")
	if len(endpoint) > 0 {
		return endpoint
	}
	if len(g.Config.S3API.S3Region) == 0 {
		return "garage"
	}
	return g.Config.S3API.S3Region
}

func (g *garage) GetAdminKey() string {
	key := os.Getenv("API_ADMIN_KEY")
	if len(key) > 0 {
		return key
	}
	return g.Config.Admin.AdminToken
}

// Fetch GETs an admin API path (with its query string) using the admin token and returns the body
// of a 200 reply. Any other status is an error carrying Garage's own message when it sent one.
func (g *garage) Fetch(path string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, g.GetAdminEndpoint()+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", g.GetAdminKey()))

	res, err := adminClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != 200 {
		message := fmt.Sprintf("unexpected status code: %d", res.StatusCode)
		var data map[string]interface{}
		if json.Unmarshal(body, &data) == nil && data["message"] != nil {
			message = fmt.Sprintf("%v", data["message"])
		}

		return nil, errors.New(message)
	}

	return body, nil
}

// FetchJSON is Fetch followed by decoding the body into T.
func FetchJSON[T any](path string) (T, error) {
	var data T
	body, err := Garage.Fetch(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(body, &data)
	return data, err
}
