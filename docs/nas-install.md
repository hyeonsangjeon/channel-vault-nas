# NAS install guide (Synology / QNAP)

This guide covers deploying Channel Vault NAS on a NAS with Docker, plus
bare-metal/VM host installs. It is a guarded **alpha→beta**: keep the raw API
loopback-bound, set an operator token, and publish only the web tier through a
trusted reverse proxy or VPN.

Read first: [`README.md`](../README.md) Quickstart, the
[Known Limitations](../README.md#known-limitations), and
[`docs/deployment-security.md`](deployment-security.md).

## Before you start

Decide on **three separate host folders** so metadata, media, and runtime
overrides are independently backed up and never mixed:

| Purpose | Container path | Example NAS path |
| --- | --- | --- |
| SQLite metadata DB + startup backups | `/app/metadata` | `/volume1/channel-vault-nas/metadata` |
| Archived media + sidecars | `/app/downfolder` | `/volume1/channel-vault-nas/archive` |
| Managed `.env.runtime` overrides | `/app/runtime` | `/volume1/channel-vault-nas/runtime` |

Generate an operator token (or use Settings → Env guide → Public access guard):

```bash
openssl rand -base64 36
```

After the stack is up, the dashboard **NAS Mount Doctor** strip verifies these
paths are writable and separated, and the **Public access guard** confirms the
token is active before you expose the console.

## Synology (Container Manager / DSM 7.2+)

1. **Create shared folders** for `metadata`, `archive`, and `runtime` under a
   volume (Control Panel → Shared Folder), e.g. `/volume1/channel-vault-nas/...`.
2. **Get the app**: clone this repo to the NAS (or copy `docker-compose.yml` and
   `.env.example`). In **Container Manager → Project → Create**, point at the
   folder containing `docker-compose.yml`.
3. **Configure `.env`** (copy from `.env.example`) and set:

   ```env
   CVN_AUTH_TOKEN=replace-with-the-generated-token
   CVN_METADATA_HOST_DIR=/volume1/channel-vault-nas/metadata
   CVN_DOWNLOAD_HOST_DIR=/volume1/channel-vault-nas/archive
   CVN_RUNTIME_HOST_DIR=/volume1/channel-vault-nas/runtime
   # Keep the raw API on loopback; only the web port is published.
   CVN_API_PORT=127.0.0.1:8000
   CVN_WEB_PORT=5173
   ```

4. **Build/run** the project. Or pull published images instead of building (see
   README → "Run a published image").
5. **Reverse proxy + TLS**: use DSM **Control Panel → Login Portal → Advanced →
   Reverse Proxy** to map an HTTPS hostname to the web port `127.0.0.1:5173`
   (enable WebSocket via custom headers `Upgrade`/`Connection`). Do **not**
   expose the API port. Concrete Nginx/Caddy/Cloudflare Tunnel snippets are in
   [`docs/deployment-security.md`](deployment-security.md).
6. **Optional in-app restart**: set `CVN_RESTART_ADAPTER=synology-package` and
   `CVN_RESTART_SERVICE_NAME=<package>` to surface `synopkg restart <package>`.
   It stays copy-only until `CVN_RESTART_ADAPTER_EXECUTE=true`.

## QNAP (Container Station)

1. **Create shared folders** for `metadata`, `archive`, and `runtime`.
2. In **Container Station → Applications → Create**, import `docker-compose.yml`.
3. Set the same `.env` values as the Synology section (token, host dirs,
   loopback API bind).
4. **Reverse proxy + TLS**: front the web port with QNAP's web server / a
   reverse proxy app, or an external proxy. Publish only the web tier.
5. **Optional in-app restart**: set `CVN_RESTART_ADAPTER=qnap-package` and
   `CVN_RESTART_SERVICE_NAME=<package>` to surface
   `/etc/init.d/<package>.sh restart` (copy-only until execution is enabled and
   the init script exists).

## Bare-metal / VM host (systemd or supervisor)

For non-Docker hosts, run the API with the project virtualenv and serve the
built frontend with your web server. Ready-to-edit examples:

- [`deploy/systemd/channel-vault-nas-api.service`](../deploy/systemd/channel-vault-nas-api.service)
- [`deploy/supervisor/channel-vault-nas-api.conf`](../deploy/supervisor/channel-vault-nas-api.conf)
- Usage: [`deploy/README.md`](../deploy/README.md)

## Restart adapters

`CVN_RESTART_ADAPTER` makes Settings → Env guide show the correct restart
command. Executable restart additionally needs `CVN_RESTART_ADAPTER_EXECUTE=true`
and an available command; it is copy-only (safe) by default.

| Adapter | Generated command |
| --- | --- |
| `docker-compose` | `docker compose [-f <file>] restart <service>` |
| `systemd` | `systemctl restart <service>` |
| `supervisor` | `supervisorctl restart <service>` |
| `synology-package` | `synopkg restart <package>` |
| `qnap-package` | `/etc/init.d/<package>.sh restart` |
| `auto` | detects Docker Compose / systemd / supervisor / Synology / QNAP |

## After install

- Verify the stack with [`scripts/compose-smoke.sh`](../scripts/compose-smoke.sh)
  (override ports for collision-free checks).
- Set up backups before archiving anything real:
  [`docs/backup-restore.md`](backup-restore.md).
- Real downloads stay disabled until you set `CVN_DOWNLOAD_WORKER_ENABLED=true`
  and confirm the guarded worker pass.
