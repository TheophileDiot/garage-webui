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

The app requests `openid profile offline_access`, verifies the ID token's signature, issuer, audience, expiry and nonce, and keeps tokens away from the browser. Add the `offline_access` scope mapping to the Authentik provider so it issues a refresh token. Discovery/token requests use the server's trusted CA certificates. Do not disable TLS verification for an internal identity provider. Authorization, token, JWKS and revocation endpoints must also use HTTPS outside loopback development (an insecure `revocation_endpoint` is ignored, with a startup log line). Discovery has a 10-second timeout at startup; an unavailable or invalid provider stops the app, and Compose retries through its restart policy. Start the identity provider before this console.

Sessions live in server memory, expire after at most eight hours, and idle out after 30 minutes. Restarting the app logs everyone out. When the identity provider returns a refresh token, the session does not end with the ID token: once the ID token expires (or is within 30 seconds of expiring) the server silently refreshes it and re-checks the subject and the `groups` claim. The `groups` claim must therefore also be present in ID tokens issued on refresh. Removing someone from the allowed group takes effect within one ID token lifetime; a failed refresh ends the session and the browser returns to the sign-in page. Refresh tokens stay in server memory and never reach the browser or the logs. The refresh token of a session that idled out is dropped from memory at the next sign-in sweep and expires at the identity provider on its own. If the provider issues no refresh token, the app logs one line at sign-in and the session ends at the ID token's expiry. Sign-out destroys the application session and revokes the refresh token at the identity provider when it advertises a `revocation_endpoint`; it does not sign out of Authentik itself.

### Local login

Set `AUTH_USER_PASS` to `username:bcrypt_hash`. Generate the hash with a trusted bcrypt/htpasswd tool. Keep it in the local `.env` or secret manager; never in a `VITE_` variable. Single-quote a bcrypt value in a Compose `.env` file so its `$` characters remain literal. Local login is intended for a private deployment without OIDC, not as an SSO bypass. Keep it private and apply login rate limiting at the reverse proxy; the application has no account lockout or brute-force limiter.

### Admin API allow-list and audit log

The console forwards to the Garage admin API (v2.5) only the operations its screens call, listed by name, method and path in `backend/router/admin_ops.json`. Anything else, such as `CreateAdminToken`, `PurgeBlocks`, `LaunchRepairOperation` or `/metrics`, gets HTTP 403 with a JSON error and never reaches Garage. Matching is exact: the method as sent, the decoded path, no trailing slash, and no percent-encoded variant (`%2e%2e`, `%2F`). A new feature that needs another operation must add it to that file; a backend test scans `src/` and fails when a UI call is missing from the list or an entry is no longer used.

Every state-changing request (any method other than GET, HEAD and OPTIONS on `/api`, including the object browser's upload and delete, password sign-in and sign-out), every OIDC callback, success or failure, although it is a GET (`target.outcome` names the result: `success`, `state_invalid`, `provider_error`, `exchange_failed`, `token_invalid`, `claims_invalid`, `group_denied` or `session_failed`; the actor is the verified OIDC subject when the ID token got that far, `anonymous` before; the code, state, tokens and the provider's error text are never logged) and every secret reveal (`GetKeyInfo` with `showSecretKey`) writes one JSON line to **stdout**; the application log stays on stderr. Example:

```json
{
  "time": "2026-11-04T12:00:00Z",
  "event": "mutation",
  "actor": { "kind": "oidc", "sub": "4f3a…", "name": "Garage Operator" },
  "method": "POST",
  "operation": "DeleteKey",
  "target": { "id": "GK1234" },
  "status": 200
}
```

- `event` is `mutation` or `secret_reveal`. `actor.kind` is `oidc` (`sub` is the OIDC subject), `local` (`sub` is the username) or `anonymous` (failed sign-in).
- `operation` is the Garage operation name, the route (`PUT /browse/{bucket}/{key...}`), or `unlisted` for a refused admin request, which also carries its `path`.
- `target` holds the IDs taken from the URL path or query (`id`, `search`, `globalAlias`, `node`, `bucket`, `key`). Request and response bodies, cookies, tokens and secrets are never logged, so an operation whose IDs travel in the body (for example `AllowBucketKey`) logs none.
- Garage still sees one admin token; this log is the only record of which person acted. Ship stdout to your log collector and protect it like any security log. Reads are not logged, and neither are anonymous requests refused with 401.

### Security headers

The application sets these itself; a signed-in session is a full Garage administrator, so script injection is the case they are built for.

| Response                               | Header                                                         | Value                                                                                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All                                    | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | `nosniff`, `DENY`, `same-origin`                                                                                                                                                                                                      |
| All                                    | `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`   | `same-origin`                                                                                                                                                                                                                         |
| All                                    | `Permissions-Policy`                                           | camera, microphone, geolocation, payment, usb, display-capture, accelerometer, gyroscope and magnetometer denied                                                                                                                      |
| All, only when `PUBLIC_URL` is `https` | `Strict-Transport-Security`                                    | `max-age=31536000` (no `includeSubDomains`, no `preload`)                                                                                                                                                                             |
| API JSON, errors, redirects, assets    | `Content-Security-Policy`                                      | `default-src 'none'; frame-ancestors 'none'`                                                                                                                                                                                          |
| Console HTML                           | `Content-Security-Policy`                                      | `default-src 'self'; script-src 'self' 'sha256-…'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` |
| Stored objects                         | `Content-Security-Policy`                                      | `sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'`, plus `Cache-Control: no-store` (thumbnails too)                                                                                      |

The `sha256-…` entries are computed at startup from the inline scripts of the `index.html` actually served (after the `BASE_PATH` rewrite), so they follow the build. Scripts never get `'unsafe-inline'` or `'unsafe-eval'`. `style-src` keeps `'unsafe-inline'` because two dependencies append a `<style>` element at runtime (sonner for toasts, react-style-singleton for the dialog scroll lock) and neither accepts a nonce. Object downloads send `Content-Disposition` with an ASCII `filename` and an RFC 5987 `filename*`, so keys with spaces, quotes, `;`, backslashes or non-ASCII text download under a safe name.

Behind a reverse proxy or WAF (for example BunkerWeb): when the proxy also sends a `Content-Security-Policy`, the browser enforces both, so a proxy policy stricter than the one above breaks the console (blocked scripts or styles, a blank page). Let the application own the CSP and turn the proxy's off or leave it unset for this service. Set HSTS at the layer that terminates TLS: the application only sends it when `PUBLIC_URL` is `https`, so do not send it twice with different values.

## Container deployment

`compose.yaml` builds this fork locally. `ghcr.io/theophilediot/garage-webui:local` is a local image tag, **not a published release**. No registry publication or production deployment happens automatically. Once an image is published, pin its release tag and global manifest digest in the infrastructure repository.

Copy `.env.example` to a local `.env`, fill the Garage admin key, public origin and chosen authentication settings, then build/start the Compose stack using your normal deployment workflow. The external network named by `GARAGE_NETWORK` must already exist and reach Garage. Garage's admin and S3 listeners should remain private.

The supplied stack publishes on loopback by default. Attach your reverse proxy to the private network, or explicitly choose a private listening address. Configure TLS at that proxy and use the same browser origin in `PUBLIC_URL`. Cross-origin write requests are rejected. Programmatic same-origin clients without an `Origin` header must send `X-Requested-With: garage-webui` as well as their authenticated session cookie.

The image runs as UID/GID 65532 with a read-only root filesystem, no Linux capabilities and a 64 MiB temporary filesystem. A multipart upload above 1 MiB is spooled whole to `/tmp`, a smaller one stays in memory. `UPLOAD_MAX_BYTES` caps one upload request (multipart overhead included; a larger one gets `413` and a plain-text message) and is also the budget of upload bytes in flight across all clients: each request is charged its `Content-Length` (the whole cap when it has none) until it ends, and a request that does not fit waits for room in arrival order (several files or several tabs queue instead of piling up). After 10 minutes of waiting it gets `503` with `Retry-After: 30`. Memory and `/tmp` together therefore hold about `UPLOAD_MAX_BYTES` of upload data at most, plus parser buffers and heap the runtime has not yet returned, so the cap sizes both: keep the `/tmp` size above the cap and leave the container memory limit room above it for the process (measured with a 60 MiB cap, a 64 MiB `/tmp` and a 128 MiB limit: peak 84 MiB, 60 MiB of it in `/tmp`; many small files at once were not measured). With the default 5 GiB cap, uploads of that size run one at a time; use a direct S3 client for larger objects. The supplied network and `Europe/Paris` timezone defaults follow this fork's deployment conventions. It includes its own healthcheck and CA certificates. No Garage config mount is required when API settings are supplied through environment variables; if you mount a config, mount its containing directory read-only and make it readable by UID 65532.

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
| `UPLOAD_MAX_BYTES`    | Upload cap and in-flight budget, bytes; default `5368709120`.      |
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

Fonts are self-hosted: IBM Plex Sans, IBM Plex Sans Condensed and IBM Plex Mono, all SIL OFL. Their license is in `misc/licenses/IBMPlex-OFL.txt`.
