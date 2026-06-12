# Channel Vault NAS

Self-hosted NAS cockpit for YouTube channel archiving.

Channel Vault NAS turns the classic `archive.txt` idea into an operator
console: register a channel, sync metadata, skip videos already on disk, queue
only missing videos, run bounded download passes, and keep the local archive
searchable from the app.

## Images

This app is published as two images that run together with Docker Compose:

- `modenaf360/channel-vault-nas-api:0.1.0-alpha.1`
- `modenaf360/channel-vault-nas-web:0.1.0-alpha.1`

Both images are multi-arch: `linux/amd64` and `linux/arm64`.

## Quick Start

```bash
git clone https://github.com/hyeonsangjeon/channel-vault-nas.git
cd channel-vault-nas
cp .env.example .env
mkdir -p metadata downfolder runtime

export CVN_API_IMAGE=modenaf360/channel-vault-nas-api:0.1.0-alpha.1
export CVN_WEB_IMAGE=modenaf360/channel-vault-nas-web:0.1.0-alpha.1
docker compose pull
docker compose up -d --no-build
```

Open `http://127.0.0.1:5173/`.

## Guardrails

This is a guarded public alpha for localhost, private LAN, VPN, or trusted
reverse-proxy use. Do not expose it directly to the public internet. Set
`CVN_AUTH_TOKEN` for LAN/NAS demos.

Downloads are disabled by default and worker passes are bounded. The filesystem
remains the durable archive; SQLite is the searchable index.

## Links

- GitHub: <https://github.com/hyeonsangjeon/channel-vault-nas>
- Manual: <https://hyeonsangjeon.github.io/channel-vault-nas/>
- Release: <https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.1.0-alpha.1>
