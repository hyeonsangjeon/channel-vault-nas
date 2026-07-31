# Compatibility and real NAS reports

Channel Vault NAS publishes multi-architecture images for `linux/amd64` and
`linux/arm64`. The Compose release uses the same images on Docker Desktop,
Synology Container Manager, QNAP Container Station, Portainer, and other Docker
hosts.

## What has been verified

| Environment | Status | Evidence |
| --- | --- | --- |
| Docker Desktop on Apple Silicon | Verified | API/Web Compose startup, health checks, browser smoke tests, and real `yt-dlp` worker passes |
| DSM-compatible x86 NAS | Maintainer smoke-tested | Docker 20.10 + Compose 1.28.5 no-clone pull/start, health checks, persistent mounts, channel registration, automatic backup, restart, and library indexing |
| `linux/amd64` image | Published and pull-tested | Multi-architecture manifest and anonymous Docker Hub pull smoke |
| `linux/arm64` image | Published and pull-tested | Multi-architecture manifest and anonymous Docker Hub pull smoke |
| Synology DSM Container Manager | Compose instructions available | More model and DSM-version reports wanted |
| QNAP Container Station | Compose instructions available | Hardware report wanted |
| Unraid, TrueNAS SCALE, UGREEN, ZimaOS | Standard Compose expected | Community verification wanted |

"Published" proves that the image can be pulled for that architecture. It does
not replace a report from the NAS hardware you own, so unverified combinations
are labeled honestly.

## Share a two-minute report

Channel Vault does not collect install telemetry. Add a short report to the
[NAS compatibility discussion](https://github.com/hyeonsangjeon/channel-vault-nas/discussions/7)
with:

- NAS or host model and OS version
- CPU architecture (`amd64` or `arm64`)
- install path (Compose, Container Manager, Container Station, Portainer, other)
- Channel Vault version
- working, working with notes, or blocked

Remove tokens, passwords, public IP addresses, and private channel URLs before
posting logs.

Docker Hub and GHCR both support anonymous pulls. The `0.2.0`
multi-architecture manifests are verified for `linux/amd64` and `linux/arm64`.

## Minimum runtime

- Docker Engine with Compose v2 (recommended), or legacy `docker-compose`
  1.28.5 for older Synology packages
- writable host folders for metadata, archived media, and runtime settings
- outbound HTTPS access for source metadata and media requests
- enough free space for the selected channel and quality

Start with the [Docker install](docker.md), then use the
[Synology/QNAP guide](nas.md) for NAS folder paths.
