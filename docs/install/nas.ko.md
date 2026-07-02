# NAS 설치 (Synology / QNAP)

이 가이드는 Docker가 있는 NAS 배포와 베어메탈 / VM 호스트 설치를 다룹니다. 가드형
**알파 → 베타**입니다. 원시 API는 loopback에 묶어 두고, 운영자 토큰을 설정하고,
신뢰할 수 있는 리버스 프록시나 VPN을 통해 웹 계층만 공개하세요.

먼저 읽어보세요: [Docker 설치](docker.md),
[액세스 토큰](access-token.md) 페이지, 그리고 GitHub의
[`docs/deployment-security.md`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md).

## 시작하기 전에 { #before-you-start }

메타데이터, 미디어, 런타임 오버라이드를 독립적으로 백업하고 절대 섞이지 않도록
**세 개의 서로 다른 호스트 폴더**를 정하세요:

| 용도 | 컨테이너 경로 | NAS 경로 예시 |
| --- | --- | --- |
| SQLite 메타데이터 DB + 시작 백업 | `/app/metadata` | `/volume1/channel-vault-nas/metadata` |
| 아카이브된 미디어 + 사이드카 | `/app/downfolder` | `/volume1/channel-vault-nas/archive` |
| 관리형 `.env.runtime` 오버라이드 | `/app/runtime` | `/volume1/channel-vault-nas/runtime` |

운영자 토큰을 생성하세요 (또는 **Settings → Env guide → Public access guard**
사용):

```bash
openssl rand -base64 36
```

스택이 올라오면 대시보드의 **NAS Mount Doctor** 스트립이 이 경로들이 쓰기 가능하고
분리되어 있는지 확인하고, **Public access guard**가 콘솔을 공개하기 전에 토큰이
활성인지 확인합니다.

## Synology (Container Manager / DSM 7.2+)

1. **공유 폴더 생성**: 볼륨 아래에 `metadata`, `archive`, `runtime`을 만듭니다
   (제어판 → 공유 폴더), 예: `/volume1/channel-vault-nas/...`.
2. **앱 가져오기**: 이 저장소를 NAS에 클론합니다 (또는 `docker-compose.yml`과
   `.env.example`을 복사). **Container Manager → 프로젝트 → 생성**에서
   `docker-compose.yml`이 있는 폴더를 지정합니다.
3. **`.env` 구성** (`.env.example`에서 복사) 후 설정:

    ```env
    CVN_AUTH_TOKEN=replace-with-the-generated-token
    CVN_METADATA_HOST_DIR=/volume1/channel-vault-nas/metadata
    CVN_DOWNLOAD_HOST_DIR=/volume1/channel-vault-nas/archive
    CVN_RUNTIME_HOST_DIR=/volume1/channel-vault-nas/runtime
    # 원시 API는 loopback에 유지하고, 웹 포트만 공개합니다.
    CVN_API_PORT=127.0.0.1:8000
    CVN_WEB_PORT=5173
    ```

4. **빌드/실행**. 또는 빌드 대신 공개 이미지를 받습니다
   ([Docker → 공개 이미지](docker.md#start-in-60-seconds-published-images) 참고).
5. **리버스 프록시 + TLS**: DSM **제어판 → 로그인 포털 → 고급 → 리버스
   프록시**로 HTTPS 호스트명을 웹 포트 `127.0.0.1:5173`에 매핑하세요 (커스텀
   헤더 `Upgrade`/`Connection`으로 WebSocket 활성화). API 포트는 노출하지
   **마세요**. 구체적인 Nginx/Caddy/Cloudflare Tunnel 스니펫은
   [`docs/deployment-security.md`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md)에
   있습니다.
6. **선택적 인앱 재시작**: `CVN_RESTART_ADAPTER=synology-package`와
   `CVN_RESTART_SERVICE_NAME=<package>`를 설정하면 `synopkg restart <package>`가
   표시됩니다. `CVN_RESTART_ADAPTER_EXECUTE=true` 전까지는 복사 전용입니다.

## QNAP (Container Station)

1. **공유 폴더 생성**: `metadata`, `archive`, `runtime`.
2. **Container Station → 애플리케이션 → 생성**에서 `docker-compose.yml`을
   가져옵니다.
3. Synology 섹션과 같은 `.env` 값을 설정합니다 (토큰, 호스트 디렉터리, loopback
   API 바인딩).
4. **리버스 프록시 + TLS**: QNAP 웹 서버 / 리버스 프록시 앱이나 외부 프록시로 웹
   포트를 프런트합니다. 웹 계층만 공개하세요.
5. **선택적 인앱 재시작**: `CVN_RESTART_ADAPTER=qnap-package`와
   `CVN_RESTART_SERVICE_NAME=<package>`를 설정하면
   `/etc/init.d/<package>.sh restart`가 표시됩니다 (실행이 활성화되고 init
   스크립트가 있기 전까지 복사 전용).

## 베어메탈 / VM 호스트 (systemd 또는 supervisor)

비Docker 호스트에서는 프로젝트 virtualenv로 API를 실행하고 빌드된 프런트엔드를 웹
서버로 서빙합니다. GitHub의 바로 편집 가능한 예시:

- [`deploy/systemd/channel-vault-nas-api.service`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/deploy/systemd/channel-vault-nas-api.service)
- [`deploy/supervisor/channel-vault-nas-api.conf`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/deploy/supervisor/channel-vault-nas-api.conf)
- 사용법: [`deploy/README.md`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/deploy/README.md)

## 재시작 어댑터

`CVN_RESTART_ADAPTER`는 **Settings → Env guide**가 올바른 재시작 명령을 보여주게
합니다. 실행형 재시작은 추가로 `CVN_RESTART_ADAPTER_EXECUTE=true`와 사용 가능한
명령이 필요하며, 기본은 복사 전용(안전)입니다.

| 어댑터 | 생성되는 명령 |
| --- | --- |
| `docker-compose` | `docker compose [-f <file>] restart <service>` |
| `systemd` | `systemctl restart <service>` |
| `supervisor` | `supervisorctl restart <service>` |
| `synology-package` | `synopkg restart <package>` |
| `qnap-package` | `/etc/init.d/<package>.sh restart` |
| `auto` | Docker Compose / systemd / supervisor / Synology / QNAP 자동 감지 |

## 문제 해결: `{"detail":"Not Found"}` { #troubleshooting-detailnot-found }

브라우저에 다음만 보인다면:

```json
{"detail":"Not Found"}
```

React 웹 콘솔이 아니라 원시 FastAPI 백엔드를 연 것입니다. Compose 스택에서 두
공개 포트는 역할이 다릅니다:

| 포트 | 서비스 | 열어야 할 것 |
| --- | --- | --- |
| `CVN_WEB_PORT`, 기본 `5173` | `web` / nginx | 브라우저 UI, 예: `http://<nas-ip>:5173/` |
| `CVN_API_PORT`, 기본 `8000` | `api` / FastAPI | API 전용, 예: `/api/health` |

Container Manager에서 확인할 것:

1. 프로젝트는 **두 개의 컨테이너**(`api`, `web`)를 만들어야 합니다.
2. API 포트가 아니라 매핑된 **웹** 포트를 여세요.
3. DSM 리버스 프록시를 쓴다면 프록시 대상을 `127.0.0.1:8000`이 아니라 웹 포트
   `127.0.0.1:5173`으로 지정하세요.
4. API 포트를 의도적으로 공개했다면 API 헬스는 `http://<nas-ip>:8000/api/health`
   에서 따로 확인할 수 있습니다.

## 설치 후

- [`scripts/compose-smoke.sh`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/scripts/compose-smoke.sh)로
  스택을 검증하세요 (충돌 없는 점검을 위해 포트를 오버라이드).
- 노출된 웹/리버스 프록시 엔드포인트를
  [`scripts/deployment-smoke.sh`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/scripts/deployment-smoke.sh)로
  검증하세요. `CVN_DEPLOYMENT_SMOKE_AUTH_TOKEN`을 전달하면 거부/허용된
  API/WebSocket 경로를 모두 증명할 수 있습니다.
- 실제 데이터를 아카이브하기 전에 백업을 설정하세요:
  [`docs/backup-restore.md`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/backup-restore.md).
- 실제 다운로드는 [워커를 켜고](../usage/enable-downloads.md) 가드형 패스를
  확인하기 전까지 꺼져 있습니다.
