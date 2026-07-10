# Install on Synology or QNAP NAS

You need Docker, one Compose file, and three writable folders. You do **not**
need Git or a local build. The release stack exposes only the web console; the
API stays inside the private Docker network.

[Check reported environments](compatibility.md){ .md-button }
[Download the release Compose file](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/compose.release.yml){ .md-button .md-button--primary }

## Before you start

Create one app folder with three subfolders:

| Purpose | Synology example | QNAP example |
| --- | --- | --- |
| Database and backups | `/volume1/docker/channel-vault-nas/metadata` | `/share/Container/channel-vault-nas/metadata` |
| Downloaded media and sidecars | `/volume1/docker/channel-vault-nas/archive` | `/share/Container/channel-vault-nas/archive` |
| Settings changed in the app | `/volume1/docker/channel-vault-nas/runtime` | `/share/Container/channel-vault-nas/runtime` |

Keep these folders separate. Back up `metadata` and `runtime`, and include
`archive` in your normal media backup plan.

Put `compose.release.yml` in the parent app folder. With SSH, the shortest path
is:

```bash
mkdir -p channel-vault-nas/{metadata,archive,runtime}
cd channel-vault-nas
curl -fsSLO https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/compose.release.yml
```

Create a `.env` file beside it with paths for your NAS:

=== "Synology"

    ```env
    CVN_METADATA_HOST_DIR=/volume1/docker/channel-vault-nas/metadata
    CVN_DOWNLOAD_HOST_DIR=/volume1/docker/channel-vault-nas/archive
    CVN_RUNTIME_HOST_DIR=/volume1/docker/channel-vault-nas/runtime
    CVN_WEB_PORT=5173
    ```

=== "QNAP"

    ```env
    CVN_METADATA_HOST_DIR=/share/Container/channel-vault-nas/metadata
    CVN_DOWNLOAD_HOST_DIR=/share/Container/channel-vault-nas/archive
    CVN_RUNTIME_HOST_DIR=/share/Container/channel-vault-nas/runtime
    CVN_WEB_PORT=5173
    ```

Use the actual shared-folder paths shown by your NAS. If the console will be
reachable beyond a trusted private LAN, also set a long `CVN_AUTH_TOKEN` and
read [Access token](access-token.md).

## Synology DSM 7.2+ (Container Manager)

1. Open **Container Manager → Project → Create**.
2. Name the project `channel-vault-nas` and select the app folder that contains
   `compose.release.yml` and `.env`.
3. Choose the existing Compose file. Container Manager will pull the published
   API and web images; no image build is required.
4. Start the project and wait until both containers are healthy.
5. Open **`http://<NAS-IP>:5173/`**.

If DSM asks which file to use, rename `compose.release.yml` to
`docker-compose.yml`; the contents stay unchanged.

## QNAP (Container Station)

1. Open **Container Station → Applications → Create**.
2. Import `compose.release.yml` from the app folder.
3. Keep the project `.env` beside the Compose file so the three host paths are
   applied.
4. Create/start the application and wait for both containers to become healthy.
5. Open **`http://<NAS-IP>:5173/`**.

## First backup after install

1. Open **Channels**, paste a channel URL or `@handle`, and select **Preview**.
2. Confirm the source and select **Register channel**.
3. Choose the interval and videos per run, then select **Start automatic
   backup**.

Already have media or `archive.txt`? Follow [Bring an existing
archive](../usage/migrate-existing-archive.md) before step 3 so existing videos
are indexed and skipped.

## Private access and HTTPS

For a home LAN trial, open the web port directly. For remote access, prefer a
VPN such as Tailscale or a trusted reverse proxy with HTTPS and authentication.
Publish the **web** port only. The release Compose file does not publish the raw
API port.

Concrete Nginx, Caddy, and Cloudflare Tunnel examples are in
[`docs/deployment-security.md`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md).

## Troubleshooting

### The page does not open

- Confirm that both `api` and `web` containers are running and healthy.
- Confirm that another app is not already using port `5173`; change
  `CVN_WEB_PORT` in `.env` if needed.
- Check that Docker can write to all three host folders.
- Open the `web` container logs first, then the `api` logs.

### The browser shows `{"detail":"Not Found"}` { #troubleshooting-detailnot-found }

You opened a raw API port from a source/development Compose stack. Open the web
port (`5173` by default). The release Compose file avoids this mistake by
publishing only the web service.

### Registration works but downloads fail

- Open the channel and confirm **Automatic backup on** is visible.
- Check the failed item for the actual `yt-dlp` message.
- Confirm the archive folder is writable and has free space.
- Some private, age-restricted, or source-blocked videos need access features
  that this release does not yet support.

## Advanced deployment

Systemd, supervisor, restart adapters, reverse proxies, and deployment smoke
scripts are documented in the repository:

- [Deployment examples](https://github.com/hyeonsangjeon/channel-vault-nas/tree/main/deploy)
- [Deployment security](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md)
- [Backup and restore](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/backup-restore.md)
