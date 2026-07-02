# Optional access token

For LAN / NAS demos, set an operator token before starting the stack. When
enabled, every API route except `/api/health` requires the token.

## Set a token

Add it to your `.env` (or `.env.runtime`):

```env
CVN_AUTH_TOKEN=replace-with-a-long-random-token
```

Generate a strong value with:

```bash
openssl rand -base64 36
```

## Generate it inside the app

You can create, copy, and verify a token without leaving the app: open
**Settings → Env guide → Public access guard**. It:

- generates a strong token **in your browser**,
- copies the `CVN_AUTH_TOKEN=...` line for `.env.runtime`, and
- copies a `401`/`200` smoke-test command.

The token is generated locally and is never sent to the backend, logged, or
included in support bundles.

## How clients send it

When enabled, the UI shows an access gate and stores the token only in the
current browser. API clients can send either header:

```bash
curl -H "Authorization: Bearer $CVN_AUTH_TOKEN" http://127.0.0.1:8000/api/dashboard
```

or:

```bash
curl -H "X-CVN-Token: $CVN_AUTH_TOKEN" http://127.0.0.1:8000/api/dashboard
```

!!! warning "This is a local guardrail, not internet auth"
    The token is an operator guardrail. For anything outside your private
    network, add a VPN, a trusted reverse proxy, and network-level access
    control. Deployment examples for private LAN or tunnel access are in
    [`docs/deployment-security.md`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md).
