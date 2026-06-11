# Security Policy

Channel Vault NAS is currently an alpha intended for trusted local networks and
private NAS environments.

## Supported Versions

| Version | Supported |
| --- | --- |
| `main` / active alpha branches | Best-effort development support |
| Tagged public alpha releases | Best-effort security fixes |

## Current Exposure Boundary

Do not expose this alpha directly to the public internet.

The current app is designed for:

- localhost development
- private LAN access
- NAS deployments behind a trusted reverse proxy or VPN

Concrete Nginx, Caddy, and Cloudflare Tunnel examples live in
[`docs/deployment-security.md`](docs/deployment-security.md).

Before internet exposure, the project still needs production-grade auth,
authorization, CSRF posture, rate limiting, and deployment hardening.

## Optional Local Access Token

Set `CVN_AUTH_TOKEN` to require an operator token for all API routes except
`/api/health`. The browser UI will show an access gate and stores the token in
the current browser only.

Supported token transports:

- `Authorization: Bearer <token>`
- `X-CVN-Token: <token>`
- `?cvn_token=<token>` for WebSocket and browser/download URL cases where
  headers are not available

Treat this as a local/NAS guardrail. It is not a replacement for a VPN, trusted
reverse proxy, TLS termination, rate limiting, CSRF hardening, or multi-user
authorization. Rotate the token if it is leaked in logs, screenshots, shell
history, or browser profiles.

## Sensitive Data

The app can store:

- channel/source URLs
- local archive paths
- downloaded media sidecars
- runtime configuration flags
- operation logs and scheduler audit rows

The Dashboard support export asks the backend for a redacted diagnostic bundle
that strips operator tokens, absolute paths, source URLs, channel/video titles,
and generated download commands before download/copy. Still review support
bundles, logs, screenshots, and runtime files before publishing them.

## Reporting Issues

For security-sensitive issues, open a private report if GitHub private
vulnerability reporting is enabled for the repository. If it is not enabled,
open a minimal public issue that avoids exploit details and asks for a private
contact path.

For normal bugs, use the public issue tracker with reproduction steps, expected
behavior, actual behavior, and relevant logs.

## Out Of Scope

The app does not grant rights to archive third-party media. Report policy or
abuse concerns separately from software security bugs.
