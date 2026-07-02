# 설치

Channel Vault NAS를 실행하는 방법은 세 가지입니다. 하나를 고르세요:

<div class="grid cards" markdown>

-   :material-docker:{ .lg .middle } __Docker (권장)__

    ---

    공개 이미지를 받아 Compose 스택으로 실행하는 가장 빠른 경로이며, NAS
    배포에도 이 방식을 씁니다.

    [:octicons-arrow-right-24: Docker 설치](docker.md)

-   :material-nas:{ .lg .middle } __NAS (Synology / QNAP)__

    ---

    Container Manager / Container Station, 분리된 호스트 폴더, 리버스 프록시,
    선택적 인앱 재시작 어댑터.

    [:octicons-arrow-right-24: NAS 설치](nas.md)

-   :material-language-python:{ .lg .middle } __로컬 개발__

    ---

    코드를 직접 수정하려면 FastAPI 백엔드와 Vite 개발 서버를 바로 실행합니다.

    [:octicons-arrow-right-24: 로컬 개발](local-dev.md)

</div>

## 사전 준비

=== "Docker / NAS"

    - Compose 플러그인이 포함된 Docker (`docker compose`)
    - 이미지용 약 250 MB, 그리고 아카이브용 디스크 공간

=== "로컬 개발"

    - Python 3.11+
    - Node.js 20+ (CI는 Node.js 24로 검증)
    - `yt-dlp`
    - `ffmpeg` / `ffprobe`

## 세 가지 실행 모드

| 모드 | 적합한 경우 | 가이드 |
| --- | --- | --- |
| **공개 이미지 받기** | 빠르고 재현 가능한 설치 | [Docker → 공개 이미지](docker.md#start-in-60-seconds-published-images) |
| **소스에서 Compose 빌드** | 최신 `main` / 브랜치 평가 | [Docker → 소스에서 빌드](docker.md#build-from-source) |
| **로컬 개발** | 백엔드/프런트엔드 코드 수정 | [로컬 개발](local-dev.md) |

두 Docker 경로 모두 아카이브 데이터를 바인드 마운트된 호스트 폴더에 저장하므로,
미디어와 메타데이터가 컨테이너 레이어가 아닌 디스크에 남습니다.

!!! tip "NAS 운영자: 폴더부터 분리하세요"
    첫 실행 전에 SQLite 메타데이터, 내려받은 미디어, 런타임 오버라이드를 **세 개의
    서로 다른 호스트 폴더**에 두어 각각 독립적으로 백업할 수 있게 하세요.
    [NAS 설치](nas.md#before-you-start)를 참고하세요.

## 설치 후

1. 웹 콘솔을 `http://127.0.0.1:5173/` 에서 엽니다.
2. [첫 백업 마법사](../usage/first-backup.md)를 따라 첫 채널을 아카이브합니다.
3. 실제 다운로드는 [워커를 켜고](../usage/enable-downloads.md) 가드형 패스를
   확인하기 전까지 꺼져 있습니다.

!!! question "`{\"detail\":\"Not Found\"}` 만 보이나요?"
    **웹** 콘솔 대신 원시 **API** 포트를 연 것입니다. 웹 포트(`CVN_WEB_PORT`,
    기본 `5173`)를 여세요. API 포트는 `/api/health` 같은 경로만 제공합니다.
    자세한 설명은 [NAS 문제 해결](nas.md#troubleshooting-detailnot-found)에 있습니다.
