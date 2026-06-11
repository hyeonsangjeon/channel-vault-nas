# Deployment examples

Process-manager examples for **bare-metal / VM host installs** (no Docker). For
NAS and Docker deployments see [`docs/nas-install.md`](../docs/nas-install.md)
and [`docs/deployment-security.md`](../docs/deployment-security.md).

These match the in-app restart adapters so the Settings → Env guide → restart
button can restart the service after a runtime change.

| File | Use with |
| --- | --- |
| [`systemd/channel-vault-nas-api.service`](systemd/channel-vault-nas-api.service) | `CVN_RESTART_ADAPTER=systemd`, `CVN_RESTART_SERVICE_NAME=channel-vault-nas-api` |
| [`supervisor/channel-vault-nas-api.conf`](supervisor/channel-vault-nas-api.conf) | `CVN_RESTART_ADAPTER=supervisor`, `CVN_RESTART_SERVICE_NAME=channel-vault-nas-api` |

## systemd

```bash
sudo cp deploy/systemd/channel-vault-nas-api.service /etc/systemd/system/
# edit paths/user, then:
sudo systemctl daemon-reload
sudo systemctl enable --now channel-vault-nas-api
sudo systemctl status channel-vault-nas-api
```

## supervisor

```bash
sudo cp deploy/supervisor/channel-vault-nas-api.conf /etc/supervisor/conf.d/
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl status channel-vault-nas-api
```

## Notes

- Both examples keep the API on `127.0.0.1:8000`. Publish only the web tier
  through a trusted reverse proxy or tunnel, and set `CVN_AUTH_TOKEN`.
- **Env keys differ from Compose.** The `*_HOST_DIR` keys in `.env.example` are
  Docker Compose-only. Host installs set the in-process keys: `CVN_METADATA_DIR`,
  `CVN_DOWNLOAD_DIR`, `CVN_RUNTIME_ENV_FILE`.
- **Pin the DB path.** `CVN_DATABASE_URL` controls where the live SQLite DB
  lives; if unset it defaults to `<backend>/metadata/app.db` (under the install
  dir), while startup backups go under `CVN_METADATA_DIR`. Set an absolute URL
  (four slashes) so both co-locate on your NAS volume, e.g.
  `CVN_DATABASE_URL=sqlite+aiosqlite:////volume1/channel-vault-nas/metadata/app.db`.
- **Protect the token.** If you replace the placeholder `CVN_AUTH_TOKEN` inline,
  restrict the file: `chmod 600` the supervisor conf or a dedicated env file
  (conf.d files are often world-readable).
- The web tier is the built `frontend/dist/` served by your web server (e.g.
  nginx). The Docker `web` image already bundles this; for host installs build
  with `cd frontend && npm ci && npm run build` and serve `dist/`.
- In-app executable restart additionally requires `CVN_RESTART_ADAPTER_EXECUTE=true`
  and that the service account may run `systemctl`/`supervisorctl`. It stays
  copy-only (safe) by default.
