# Docker 설치

Channel Vault NAS를 실행하는 가장 빠른 방법입니다. 여기서는 두 가지 Docker
경로를 다룹니다:

1. [60초 만에 시작](#start-in-60-seconds-published-images) — 공개 이미지를
   받습니다 (빌드 없음).
2. [소스에서 빌드](#build-from-source) — 이 저장소에서 이미지를 빌드합니다.

두 경로 모두 아카이브 데이터를 바인드 마운트된 호스트 폴더(`./metadata`,
`./downfolder`, `./runtime`)에 저장합니다.

## 60초 만에 시작 (공개 이미지) { #start-in-60-seconds-published-images }

가장 빠른 경로로 릴리스 Compose 파일을 사용합니다. 웹 포트만 공개하고 API는
Compose 내부 네트워크에 둡니다:

```bash
mkdir channel-vault-nas && cd channel-vault-nas
curl -fsSLO https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/compose.release.yml
docker compose -f compose.release.yml up -d
```

구형 Synology Docker 패키지에서는 `docker compose` 대신 `docker-compose`를
사용하세요. 같은 릴리스 파일을 Compose v2와 레거시 Compose 1.28.5에서 모두
검증했습니다.

그런 다음 **`http://127.0.0.1:5173/`** 을 열고
[채널 백업 시작](../usage/first-backup.md)으로 이동하세요.

??? note "GHCR 이미지를 선호하나요?"
    `compose.release.yml` 옆에 `.env`를 만들고 두 이미지 오버라이드를 지정하세요:

    ```bash
    CVN_API_IMAGE=ghcr.io/hyeonsangjeon/channel-vault-nas-api:0.3.0
    CVN_WEB_IMAGE=ghcr.io/hyeonsangjeon/channel-vault-nas-web:0.3.0
    ```

    `CVN_API_IMAGE`와 `CVN_WEB_IMAGE`는 **항상 함께** 설정하세요. GHCR 미러와
    기본 Docker Hub 이미지 모두 로그인 없이 받을 수 있습니다.

## 소스에서 빌드 { #build-from-source }

최신 `main`이나 브랜치를 평가하기에 가장 좋습니다:

```bash
git clone https://github.com/hyeonsangjeon/channel-vault-nas.git
cd channel-vault-nas
cp .env.example .env
mkdir -p metadata downfolder runtime
docker compose up --build
```

Compose 스택은 다음을 실행합니다:

- **`api`** — `yt-dlp`, `ffmpeg`, `ffprobe`를 포함한 FastAPI 백엔드
- **`web`** — nginx로 서빙되는 React 앱
- **`./metadata`** — SQLite DB와 시작 시 백업
- **`./downfolder`** — 아카이브된 미디어와 사이드카
- **`./runtime/.env.runtime`** — Settings 탭 런타임 오버라이드

!!! tip "실제 아카이브를 건드리지 않고 검증하기"
    포트와 호스트 폴더를 바꿔 일회용 점검을 실행하세요:

    ```bash
    mkdir -p /tmp/channel-vault-compose/{metadata,downfolder,runtime}
    CVN_WEB_PORT=15173 \
    CVN_API_PORT=18000 \
    CVN_METADATA_HOST_DIR=/tmp/channel-vault-compose/metadata \
    CVN_DOWNLOAD_HOST_DIR=/tmp/channel-vault-compose/downfolder \
    CVN_RUNTIME_HOST_DIR=/tmp/channel-vault-compose/runtime \
    docker compose up --build
    ```

## 직접 `docker run` (레지스트리 스모크 테스트)

포트, 볼륨, 헬스 체크, 재시작 정책을 한 파일에 담기 때문에 Compose를 권장합니다.
하지만 두 컨테이너를 하나의 Docker 네트워크에서 직접 실행할 수도 있습니다. 웹
이미지가 `/api`와 `/ws`를 `http://api:8000`으로 프록시하므로 `api` 네트워크
별칭이 필요합니다.

```bash
export CVN_API_IMAGE=modenaf360/channel-vault-nas-api:0.3.0
export CVN_WEB_IMAGE=modenaf360/channel-vault-nas-web:0.3.0

mkdir -p metadata downfolder runtime
docker network create channel-vault-nas 2>/dev/null || true

docker run -d \
  --name channel-vault-nas-api \
  --network channel-vault-nas \
  --network-alias api \
  -p 8000:8000 \
  -e CVN_DATABASE_URL='sqlite+aiosqlite:///./metadata/app.db' \
  -e CVN_METADATA_DIR='./metadata' \
  -e CVN_DOWNLOAD_DIR='./downfolder' \
  -e CVN_RUNTIME_ENV_FILE='/app/runtime/.env.runtime' \
  -e CVN_DB_MIGRATE_ON_STARTUP=true \
  -v "$PWD/metadata:/app/metadata" \
  -v "$PWD/downfolder:/app/downfolder" \
  -v "$PWD/runtime:/app/runtime" \
  "$CVN_API_IMAGE"

docker run -d \
  --name channel-vault-nas-web \
  --network channel-vault-nas \
  -p 5173:80 \
  "$CVN_WEB_IMAGE"
```

`http://127.0.0.1:5173/` 을 엽니다. 정리는 다음과 같이 합니다:

```bash
docker rm -f channel-vault-nas-web channel-vault-nas-api
docker network rm channel-vault-nas
```

## localhost를 넘어설 때

로컬 시험 이상을 하려면 시작 **전에** `.env`를 편집하세요:

- `CVN_AUTH_TOKEN`을 길고 무작위한 값으로 설정하세요 —
  [액세스 토큰](access-token.md) 참고.
- 리버스 프록시 뒤에서는 웹 포트만 공개하고 API는 loopback에 바인딩하세요:

    ```env
    CVN_API_PORT=127.0.0.1:8000
    CVN_WEB_PORT=5173
    ```

그런 다음 호스트 폴더 분리와 리버스 프록시 레시피는
[NAS 설치 가이드](nas.md)로 이어가세요.

!!! danger "API 포트가 아니라 웹 포트를 여세요"
    `{"detail":"Not Found"}` 만 보인다면 원시 API 포트를 연 것입니다. 웹
    포트(`CVN_WEB_PORT`, 기본 `5173`)를 여세요.
    [NAS 문제 해결](nas.md#troubleshooting-detailnot-found) 참고.
