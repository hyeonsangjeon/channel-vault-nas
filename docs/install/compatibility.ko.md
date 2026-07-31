# 호환성과 실제 NAS 설치 리포트

Channel Vault NAS는 `linux/amd64`와 `linux/arm64`용 멀티 아키텍처 이미지를
배포합니다. Docker Desktop, Synology Container Manager, QNAP Container Station,
Portainer 등에서 같은 Compose 릴리스 파일을 사용합니다.

## 확인된 범위

| 환경 | 상태 | 근거 |
| --- | --- | --- |
| Apple Silicon의 Docker Desktop | 검증됨 | API/Web Compose 시작, 헬스 체크, 브라우저 스모크 테스트, 실제 `yt-dlp` 워커 실행 |
| DSM 호환 x86 NAS | 메인테이너 스모크 테스트 | Docker 20.10 + Compose 1.28.5 무클론 pull/start, 헬스 체크, 영구 마운트, 채널 등록, 자동 백업, 재시작, 라이브러리 색인 |
| `linux/amd64` 이미지 | 배포 및 pull 검증 | 멀티 아키텍처 manifest와 Docker Hub 익명 pull 스모크 |
| `linux/arm64` 이미지 | 배포 및 pull 검증 | 멀티 아키텍처 manifest와 Docker Hub 익명 pull 스모크 |
| Synology DSM Container Manager | Compose 안내 제공 | 더 많은 모델과 DSM 버전 리포트 필요 |
| QNAP Container Station | Compose 안내 제공 | 실제 장비 리포트 필요 |
| Unraid, TrueNAS SCALE, UGREEN, ZimaOS | 표준 Compose 사용 예상 | 커뮤니티 검증 필요 |

이미지가 “배포됨”은 해당 아키텍처에서 받을 수 있다는 뜻입니다. 실제 NAS 장비의
설치 성공을 대신하지 않으므로 아직 확인되지 않은 조합은 솔직하게 표시합니다.

## 2분 설치 리포트 남기기

Channel Vault는 설치 텔레메트리를 수집하지 않습니다.
[NAS 호환성 Discussion](https://github.com/hyeonsangjeon/channel-vault-nas/discussions/7)에
다음 내용을 짧게 남겨주세요.

- NAS 또는 호스트 모델과 OS 버전
- CPU 아키텍처(`amd64` 또는 `arm64`)
- 설치 방식(Compose, Container Manager, Container Station, Portainer 등)
- Channel Vault 버전
- 정상 동작, 참고사항과 함께 동작, 또는 막힘

로그를 올릴 때 토큰, 비밀번호, 공개 IP 주소, 비공개 채널 URL은 제거하세요.

Docker Hub와 GHCR 이미지 모두 로그인 없이 받을 수 있습니다.
`0.2.0` 멀티 아키텍처 manifest는 `linux/amd64`와 `linux/arm64`에서
확인했습니다.

## 최소 실행 조건

- Compose v2를 지원하는 Docker Engine(권장), 또는 구형 Synology 패키지의
  레거시 `docker-compose` 1.28.5
- 메타데이터, 아카이브 미디어, 런타임 설정용 쓰기 가능한 호스트 폴더
- 소스 메타데이터와 미디어 요청을 위한 외부 HTTPS 연결
- 선택한 채널과 화질을 보관할 충분한 여유 공간

[Docker 설치](docker.md)부터 시작하고 NAS 폴더 경로는
[Synology/QNAP 가이드](nas.md)를 참고하세요.
