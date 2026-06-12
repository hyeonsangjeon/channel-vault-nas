# Deployment Security Notes

Channel Vault NAS is an alpha for localhost, private LAN, VPN, and trusted NAS
reverse-proxy deployments. Do not expose the backend API port directly to the
public internet.

## Minimum Exposure Checklist

Before sharing the app beyond your own machine:

1. Set a long `CVN_AUTH_TOKEN`.
2. Publish only the web endpoint, not the backend API endpoint.
3. Terminate TLS at a trusted reverse proxy or tunnel.
4. Restrict access with VPN, SSO, allowlists, or a private tunnel policy when possible.
5. Keep real downloads disabled until the archive path and policy are verified.

Generate a local operator token:

```bash
openssl rand -base64 36
```

Or generate, copy, and verify one without leaving the app: open
**Settings -> Env guide -> Public access guard**. The panel generates a strong
token in your browser, copies the token once, copies the `CVN_AUTH_TOKEN=...`
line for `.env.runtime`, and copies a 401/200 smoke-test command. The token is
generated locally and never sent to the backend, logged, or included in support
bundles. Save it in your password manager before applying it.

Put it in `.env` before starting Docker Compose:

```env
CVN_AUTH_TOKEN=replace-with-the-generated-token
CVN_DOWNLOAD_WORKER_ENABLED=false
CVN_RESTART_ADAPTER_EXECUTE=false
```

The Dashboard readiness board will show an `External access` mission while
`CVN_AUTH_TOKEN` is empty, especially when the backend binds to `0.0.0.0`.
The same Nginx, Caddy, and Cloudflare Tunnel snippets below are also copyable
from Settings -> Env guide -> External exposure cookbook.

## Docker Compose Shape

The Compose stack has two published ports:

- `web`, default `5173`: serves the React app and proxies `/api/*` and `/ws/*`
  to the backend container.
- `api`, default `8000`: backend FastAPI service.

For normal LAN or reverse-proxy access, publish the web port only. If you do not
need host access to the raw API port, bind it to loopback:

```env
CVN_WEB_PORT=5173
CVN_API_PORT=127.0.0.1:8000
```

Then point your reverse proxy at:

```text
http://127.0.0.1:5173
```

The web container already handles:

- `/api/` -> backend `api:8000`
- `/ws/` -> backend `api:8000` with WebSocket upgrade headers
- `/` -> static frontend with SPA fallback

## Nginx

This example proxies a private hostname to the Compose web service. It keeps the
backend API port private and preserves WebSocket upgrade headers.

```nginx
server {
  listen 443 ssl http2;
  server_name vault.example.test;

  ssl_certificate /etc/letsencrypt/live/vault.example.test/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/vault.example.test/privkey.pem;

  client_max_body_size 64m;

  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

If your Nginx deployment already defines a `$connection_upgrade` map in the
global `http` context, using it is also fine. The inline form above is easier to
paste into NAS reverse-proxy UIs that only expose a server or location block.

## Caddy

```caddyfile
vault.example.test {
  encode zstd gzip
  reverse_proxy 127.0.0.1:5173
}
```

Caddy handles TLS and WebSocket upgrades automatically. Put any SSO, VPN, or
network allowlist in front of this route when exposing it outside a private LAN.

## Cloudflare Tunnel

Use a tunnel when you do not want to open inbound NAS ports. Point the tunnel at
the Compose web service, not the backend API port:

```yaml
tunnel: channel-vault-nas
credentials-file: /etc/cloudflared/channel-vault-nas.json

ingress:
  - hostname: vault.example.test
    service: http://127.0.0.1:5173
  - service: http_status:404
```

Recommended Cloudflare Access policy:

- require your identity provider login
- allow only named users or a private group
- keep browser session duration short for shared machines

## Smoke Checks

From a machine that can reach the exposed hostname:

```bash
curl -i https://vault.example.test/api/health
```

Expected: `200`.

Without a token:

```bash
curl -i https://vault.example.test/api/dashboard
```

Expected when `CVN_AUTH_TOKEN` is set: `401`.

With a token:

```bash
curl -i -H "Authorization: Bearer $CVN_AUTH_TOKEN" https://vault.example.test/api/dashboard
```

Expected: `200`.

The browser UI stores the operator token in the current browser only. Rotate the
token if it appears in logs, screenshots, shell history, or a shared browser
profile.

You can run the same checks as one command:

```bash
CVN_DEPLOYMENT_SMOKE_WEB_URL=https://vault.example.test \
CVN_DEPLOYMENT_SMOKE_AUTH_TOKEN="$CVN_AUTH_TOKEN" \
scripts/deployment-smoke.sh
```

The script checks the web root, proxied `/api/health`, protected
`/api/dashboard` `401`/`200` behavior, bearer and `X-CVN-Token` headers, and
WebSocket upgrade through the web/proxy endpoint. To prove a raw backend port is
not exposed from the machine where you run the check, pass a URL that should be
blocked:

```bash
CVN_DEPLOYMENT_SMOKE_WEB_URL=https://vault.example.test \
CVN_DEPLOYMENT_SMOKE_AUTH_TOKEN="$CVN_AUTH_TOKEN" \
CVN_DEPLOYMENT_SMOKE_FORBIDDEN_API_URL=http://vault.example.test:8000 \
scripts/deployment-smoke.sh
```

For self-signed TLS during a private LAN test, add
`CVN_DEPLOYMENT_SMOKE_INSECURE=true`.
