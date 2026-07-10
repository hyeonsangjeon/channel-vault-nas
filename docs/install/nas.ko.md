# Synology 또는 QNAP NAS에 설치

Docker, Compose 파일 하나, 쓰기 가능한 폴더 세 개만 있으면 됩니다. Git이나 로컬
빌드는 필요하지 않습니다. 릴리스 스택은 웹 콘솔만 공개하고 API는 Docker 내부
네트워크에 둡니다.

[확인된 환경 보기](compatibility.md){ .md-button }
[릴리스 Compose 파일 받기](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/compose.release.yml){ .md-button .md-button--primary }

## 시작하기 전에 { #before-you-start }

앱 폴더 하나와 그 아래 세 폴더를 만드세요.

| 용도 | Synology 예시 | QNAP 예시 |
| --- | --- | --- |
| 데이터베이스와 백업 | `/volume1/docker/channel-vault-nas/metadata` | `/share/Container/channel-vault-nas/metadata` |
| 다운로드 미디어와 사이드카 | `/volume1/docker/channel-vault-nas/archive` | `/share/Container/channel-vault-nas/archive` |
| 앱에서 변경한 설정 | `/volume1/docker/channel-vault-nas/runtime` | `/share/Container/channel-vault-nas/runtime` |

세 폴더는 서로 분리하세요. `metadata`와 `runtime`을 백업하고, `archive`는 평소
미디어 백업 대상에 포함하세요.

부모 앱 폴더에 `compose.release.yml`을 둡니다. SSH를 쓴다면 다음이 가장
짧습니다.

```bash
mkdir -p channel-vault-nas/{metadata,archive,runtime}
cd channel-vault-nas
curl -fsSLO https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/compose.release.yml
```

같은 위치에 NAS 경로를 적은 `.env` 파일을 만드세요.

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

NAS에 표시된 실제 공유 폴더 경로를 사용하세요. 신뢰할 수 있는 사설 LAN 밖에서도
콘솔을 열 계획이라면 긴 `CVN_AUTH_TOKEN`도 설정하고 [액세스
토큰](access-token.md)을 읽으세요.

## Synology DSM 7.2+ (Container Manager)

1. **Container Manager → 프로젝트 → 생성**을 엽니다.
2. 프로젝트 이름을 `channel-vault-nas`로 정하고 `compose.release.yml`과 `.env`가
   있는 앱 폴더를 선택합니다.
3. 기존 Compose 파일을 선택합니다. Container Manager가 공개된 API와 웹 이미지를
   받으므로 이미지 빌드는 필요하지 않습니다.
4. 프로젝트를 시작하고 두 컨테이너가 모두 정상 상태가 될 때까지 기다립니다.
5. **`http://<NAS-IP>:5173/`**을 엽니다.

DSM이 파일 이름을 지정하라고 하면 `compose.release.yml`을
`docker-compose.yml`로 바꾸세요. 내용은 그대로 둡니다.

## QNAP (Container Station)

1. **Container Station → 애플리케이션 → 생성**을 엽니다.
2. 앱 폴더의 `compose.release.yml`을 가져옵니다.
3. 세 호스트 경로가 적용되도록 프로젝트 `.env`를 Compose 파일 옆에 둡니다.
4. 애플리케이션을 만들고 시작한 뒤 두 컨테이너가 정상 상태가 될 때까지
   기다립니다.
5. **`http://<NAS-IP>:5173/`**을 엽니다.

## 설치 후 첫 백업

1. **채널**을 열고 채널 URL 또는 `@handle`을 붙여넣은 뒤 **미리보기**를
   누릅니다.
2. 소스를 확인하고 **채널 등록**을 누릅니다.
3. 간격과 한 번에 받을 영상 수를 고른 다음 **자동 백업 시작**을 누릅니다.

이미 미디어나 `archive.txt`가 있나요? 3단계 전에 [기존 아카이브
가져오기](../usage/migrate-existing-archive.md)를 따라 하면 기존 영상이 색인되고
다운로드에서 건너뜁니다.

## 사설 접속과 HTTPS

홈 LAN에서 시험할 때는 웹 포트를 바로 열어도 됩니다. 외부에서 접속한다면
Tailscale 같은 VPN이나 HTTPS와 인증을 제공하는 신뢰할 수 있는 리버스 프록시를
권장합니다. **웹** 포트만 공개하세요. 릴리스 Compose 파일은 원시 API 포트를
공개하지 않습니다.

Nginx, Caddy, Cloudflare Tunnel 예시는
[`docs/deployment-security.md`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md)에
있습니다.

## 문제 해결

### 화면이 열리지 않음

- `api`와 `web` 컨테이너가 모두 실행 중이고 정상 상태인지 확인합니다.
- 다른 앱이 이미 `5173` 포트를 쓰는지 확인하고, 필요하면 `.env`의
  `CVN_WEB_PORT`를 바꿉니다.
- Docker가 세 호스트 폴더에 쓸 수 있는지 확인합니다.
- 먼저 `web`, 다음으로 `api` 컨테이너 로그를 확인합니다.

### 브라우저에 `{"detail":"Not Found"}`만 표시됨 { #troubleshooting-detailnot-found }

소스/개발 Compose의 원시 API 포트를 연 것입니다. 기본 `5173` 웹 포트를 여세요.
릴리스 Compose 파일은 웹 서비스만 공개하므로 이 실수를 방지합니다.

### 채널 등록은 되지만 다운로드가 실패함

- 채널 화면에 **자동 백업 켜짐**이 표시되는지 확인합니다.
- 실패 항목에서 실제 `yt-dlp` 메시지를 확인합니다.
- 아카이브 폴더의 쓰기 권한과 여유 공간을 확인합니다.
- 비공개, 연령 제한, 소스 차단 영상은 현재 릴리스가 아직 지원하지 않는 접근
  기능이 필요할 수 있습니다.

## 고급 배포

Systemd, supervisor, 재시작 어댑터, 리버스 프록시, 배포 스모크 스크립트는
저장소 문서에 있습니다.

- [배포 예시](https://github.com/hyeonsangjeon/channel-vault-nas/tree/main/deploy)
- [배포 보안](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md)
- [백업과 복구](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/backup-restore.md)
