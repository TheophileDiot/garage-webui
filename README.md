# Garage WebUI

A private administration console for [Garage](https://garagehq.deuxfleurs.fr/): cluster health and layout, buckets, objects and access keys. This fork adds a focused light/dark interface, native OpenID Connect SSO and mandatory authentication.

Based on [khairul169/garage-webui](https://github.com/khairul169/garage-webui), under the original MIT license. Repository: [TheophileDiot/garage-webui](https://github.com/TheophileDiot/garage-webui). Local checkout convention: `fork-garage-webui`; application and image name: `garage-webui`.

## Authentication is required

This changes upstream behavior: an unset `AUTH_USER_PASS` no longer exposes an unauthenticated console. Startup fails unless either local bcrypt credentials or the complete OIDC configuration is present. OIDC takes precedence and disables the password endpoint. Partial OIDC settings fail startup rather than falling back to local login.

**Every admitted user has full Garage administrator access**, including bucket/key deletion and cluster layout changes. Restrict the OIDC group to trusted operators. This is not a multi-tenant S3 client and has no read-only role.

`PUBLIC_URL` is the browser-facing origin, for example `https://garage-ui.example.com`. HTTPS is required except for loopback development. Use a lowercase host and omit the default port (`:443` for HTTPS, `:80` for HTTP). Put a path prefix in `BASE_PATH`, not in `PUBLIC_URL`. Keep the prefix when forwarding requests through a reverse proxy.

### Authentik / OpenID Connect

Create a confidential OAuth2/OpenID provider and application in Authentik:

1. Use the authorization-code flow and assign an RSA signing key to the provider (RS256). The client sends PKCE S256, state and nonce; unsigned or HS256-only ID tokens are not supported.
2. Set the redirect URI to exactly `https://garage-ui.example.com/api/auth/oidc/callback`. With `BASE_PATH=/garage`, use `https://garage-ui.example.com/garage/api/auth/oidc/callback`.
3. Use the application's issuer URL from its discovery document as `OIDC_ISSUER_URL`, typically `https://auth.example.com/application/o/garage-webui/`.
4. Set `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` from that provider.
5. Include a `groups` string-array claim in the **ID token**. Bind an appropriate scope mapping to the requested `profile` scope; a claim only returned by UserInfo is insufficient. Example claim: `"groups": ["garage-admins"]`.
6. Set `OIDC_ALLOWED_GROUPS=garage-admins`, or a comma-separated list. Membership in at least one listed group is required. Missing, empty or malformed group claims deny access.

The app requests `openid profile`, verifies the ID token's signature, issuer, audience, expiry and nonce, and keeps tokens away from the browser. Discovery/token requests use the server's trusted CA certificates. Do not disable TLS verification for an internal identity provider. Authorization, token and JWKS endpoints must also use HTTPS outside loopback development. Discovery has a 10-second timeout at startup; an unavailable or invalid provider stops the app, and Compose retries through its restart policy. Start the identity provider before this console.

Sessions live in server memory, expire after at most eight hours (or the ID token's earlier expiry), and idle out after 30 minutes. Restarting the app logs everyone out. Sign-out destroys the application session; it does not sign out of Authentik. Group changes take effect on the next login or session expiry, not continuously during a session.

### Local login

Set `AUTH_USER_PASS` to `username:bcrypt_hash`. Generate the hash with a trusted bcrypt/htpasswd tool. Keep it in the local `.env` or secret manager; never in a `VITE_` variable. Single-quote a bcrypt value in a Compose `.env` file so its `$` characters remain literal. Local login is intended for a private deployment without OIDC, not as an SSO bypass. Keep it private and apply login rate limiting at the reverse proxy; the application has no account lockout or brute-force limiter.

## Container deployment

`compose.yaml` builds this fork locally. `ghcr.io/theophilediot/garage-webui:local` is a local image tag, **not a published release**. No registry publication or production deployment happens automatically. Once an image is published, pin its release tag and global manifest digest in the infrastructure repository.

Copy `.env.example` to a local `.env`, fill the Garage admin key, public origin and chosen authentication settings, then build/start the Compose stack using your normal deployment workflow. The external network named by `GARAGE_NETWORK` must already exist and reach Garage. Garage's admin and S3 listeners should remain private.

The supplied stack publishes on loopback by default. Attach your reverse proxy to the private network, or explicitly choose a private listening address. Configure TLS at that proxy and use the same browser origin in `PUBLIC_URL`. Cross-origin write requests are rejected. Programmatic same-origin clients without an `Origin` header must send `X-Requested-With: garage-webui` as well as their authenticated session cookie.

The image runs as UID/GID 65532 with a read-only root filesystem, no Linux capabilities and a 64 MiB temporary filesystem. Multipart uploads above 32 MiB spill the whole file to `/tmp`; large or concurrent uploads can exhaust that space. Increase the Compose `/tmp` capacity or use a direct S3 client for larger objects. The supplied network and `Europe/Paris` timezone defaults follow this fork's deployment conventions. It includes its own healthcheck and CA certificates. No Garage config mount is required when API settings are supplied through environment variables; if you mount a config, mount its containing directory read-only and make it readable by UID 65532.

### Configuration

| Variable              | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `PUBLIC_URL`          | Required browser-facing origin, without a path or trailing slash.  |
| `BASE_PATH`           | Optional prefix, e.g. `/garage`; no trailing slash.                |
| `AUTH_USER_PASS`      | Local `username:bcrypt_hash`, when not using OIDC.                 |
| `OIDC_ISSUER_URL`     | OIDC discovery issuer; configure all four OIDC variables together. |
| `OIDC_CLIENT_ID`      | Confidential client ID.                                            |
| `OIDC_CLIENT_SECRET`  | Confidential client secret.                                        |
| `OIDC_ALLOWED_GROUPS` | Comma-separated allowed group names; at least one required.        |
| `API_BASE_URL`        | Garage admin API origin, e.g. `http://garage:3903`.                |
| `API_ADMIN_KEY`       | Garage admin token; server-side only.                              |
| `S3_ENDPOINT_URL`     | Private S3 endpoint, e.g. `http://garage:3900`.                    |
| `S3_REGION`           | Garage region, default `garage`.                                   |
| `CONFIG_PATH`         | Optional Garage TOML path, default `/etc/garage.toml`.             |
| `HOST` / `PORT`       | App listener, defaults `0.0.0.0:3909`.                             |
| `TZ`                  | Timezone; Compose sets `Europe/Paris`.                             |
| `LISTEN_IP`           | Compose host binding, default `127.0.0.1`.                         |
| `GARAGE_NETWORK`      | Existing Compose network, default `garage-net`.                    |

Garage TOML remains supported for non-secret configuration and server credentials. RPC, admin and metrics secrets are excluded from the browser configuration response. Browser cookies and authorization headers are never forwarded to Garage.

Stored objects are treated as untrusted documents. Object previews use a sandboxed Content Security Policy and are not cached as administrator pages; HTML, PDF and media previews may therefore be restricted by the browser. Download these objects when inline rendering is blocked.

## Development and checks

Toolchain: Node 24 LTS (`.node-version`), pnpm 10.34.9, Go 1.27.3. Docker uses pinned multi-stage builders and produces a static Go binary with embedded production assets. The Go module retains its upstream import path to avoid unrelated import churn.

Install with the pinned pnpm version, copy the backend environment example to a local `.env`, and supply development credentials. `pnpm dev` runs the Vite client and Go server. The Vite proxy forwards `/api` to `VITE_API_URL`; credentials belong only in the backend environment. Build/typecheck scripts are `pnpm build` and `pnpm typecheck`; frontend lint is `pnpm lint`. Run backend checks from `backend/`: `go vet ./...` and `go test -race ./...`.

The GitHub Actions workflow runs frontend lint/typecheck/build, dependency audits, Go vet/race tests, vulnerability analysis, a Docker build and an arm64 compile. It has read-only repository permissions and does not publish images or deploy services.

Auth tests use a local signed mock identity provider and cover PKCE, token claims, group denial, state replay, session rotation/logout, prefix routing and cross-origin writes. They do not prove an actual Authentik provider is configured correctly. Visual review uses synthetic Garage fixtures; validate real cluster operations and your identity provider before rollout.

Fonts are self-hosted: JetBrains Mono and Bricolage Grotesque, both SIL OFL. Their licenses are in `misc/licenses/JetBrainsMono-OFL.txt` and `misc/licenses/BricolageGrotesque-OFL.txt`.
