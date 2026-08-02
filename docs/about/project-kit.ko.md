---
title: 프로젝트 정보와 미디어
description: >-
  디렉터리 편집자, 리뷰어, 프로젝트 공유자를 위한 검증된 정보, 짧은 설명,
  스크린샷, 공식 링크입니다.
---

# 프로젝트 정보와 미디어

이 페이지는 Channel Vault NAS를 디렉터리, 리뷰, 커뮤니티 글에 소개할 때 사용하는
공식 정보입니다. 홍보 문구보다 검증 가능한 사실과 최신 자료를 모았습니다.

## 한 문장 소개

Channel Vault NAS는 채널 등록, 일정 시작, 상태 확인의 세 단계로 YouTube 채널을
NAS에 백업하고 기존 미디어와 `archive.txt`를 재사용하는 오픈소스 Docker
앱입니다.

## 짧은 디렉터리 설명

YouTube 채널을 Docker NAS에 백업합니다. 채널을 등록하고, 제한된 `yt-dlp`
일정을 시작한 뒤, 저장된 영상 수와 남은 영상 수를 확인합니다. 기존 미디어와
`archive.txt`를 가져올 수 있고 마운트된 폴더와 사이드카에서 색인을 복구할 수
있습니다.

## 검증된 정보

| 항목 | 현재 값 |
| --- | --- |
| 라이선스 | [MIT](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/LICENSE) |
| 소스 | [GitHub](https://github.com/hyeonsangjeon/channel-vault-nas) |
| 현재 릴리스 | [`v0.3.0`](https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.3.0) |
| 첫 공개 릴리스 | 2026년 6월 11일 |
| 배포 방식 | 두 Docker 이미지와 하나의 Compose 파일 |
| 아키텍처 | `linux/amd64`, `linux/arm64` |
| 공개 레지스트리 | [Docker Hub API](https://hub.docker.com/r/modenaf360/channel-vault-nas-api), [web](https://hub.docker.com/r/modenaf360/channel-vault-nas-web) |
| 영구 저장소 | 메타데이터, 아카이브 미디어, 런타임 설정용 개별 바인드 마운트 |
| 다운로드 엔진 | API 이미지의 `yt-dlp`, `ffmpeg`, `ffprobe` |
| UI 언어 | 영어, 한국어, 일본어, 중국어 간체, 힌디어 |
| 권장 네트워크 | localhost, 사설 LAN/VPN, 신뢰할 수 있는 인증 리버스 프록시 |

## 차별점

- 기본 화면은 채널 등록, 백업 일정, 하나의 명확한 상태에 집중합니다. 대기열,
  저장소 진단, 런타임 제어는 필요할 때만 **고급 관리**에서 엽니다.
- 기존 NAS 미디어, 자막, 썸네일, `info.json` 사이드카를 일부러 다시 받지 않고
  색인할 수 있습니다.
- `archive.txt` 판단이 명령행 옵션 안에 사라지지 않고 다운로드됨, 없음, 대기,
  건너뜀 상태로 남습니다.
- 보존 감시(Preservation Watch)는 저장한 영상이 원본에서 사라지는 순간을
  포착해 NAS가 마지막 사본을 가졌음을 확인하고, 보존 매니페스트로 내보낼 수
  있습니다.
- 파일시스템은 영구 아카이브이고 SQLite는 백업하거나 재구축할 수 있는 검색
  색인입니다.
- 채널 등록과 실제 다운로드가 분리되어 있습니다. 운영자가 자동 백업을 시작한
  뒤에만 다운로드가 실행됩니다.

TubeArchivist, Pinchflat, TubeSync, ytdl-sub가 더 잘 맞는 경우는 [솔직한 워크플로
비교](comparison.md)를 참고하세요.

## 미디어 자료

앞의 두 자료는 현재 일상 작업 흐름을 보여주므로 디렉터리와 리뷰에서 우선 사용해
주세요. 나머지는 보조 자료입니다. 프로젝트 링크와 출처를 함께 표시하면 소개
글에 사용할 수 있습니다.

- [간단한 홈과 3단계 흐름](../assets/user-manual/ko/01-home.png)
- [채널 백업 상태](../assets/user-manual/ko/02-channel-overview.png)
- [채널 등록](../assets/user-manual/ko/03-channel-registration.png)
- [1280x640 소셜 프리뷰](../assets/social-preview.png)
- [240x240 프로젝트 아이콘](../assets/producthunt-thumbnail.png)
- [기존 아카이브 가져오기](../assets/screenshots/existing-archive-import.png)
- [12초 제품 데모](../assets/demo/channel-vault-public-alpha.gif)

## 디렉터리 등록 권장값

| 항목 | 권장값 |
| --- | --- |
| 이름 | Channel Vault NAS |
| 분류 | 셀프 호스팅 미디어 아카이브 / NAS 백업 |
| 태그 | self-hosted, NAS, YouTube backup, yt-dlp, archive.txt, Docker |
| 웹사이트 | `https://hyeonsangjeon.github.io/channel-vault-nas/` |
| 저장소 | `https://github.com/hyeonsangjeon/channel-vault-nas` |
| 설치 안내 | `https://hyeonsangjeon.github.io/channel-vault-nas/ko/install/docker/` |

## 현재 한계

- 아직 성숙한 미디어 서버를 대체하는 완성 버전이 아닌 public alpha입니다.
- 쿠키 또는 인증된 비공개 영상을 받는 공식 흐름은 아직 제공하지 않습니다.
- 원본 서비스 약관, 저작권, 저장 용량, 원격 접속 보안은 운영자가 책임져야 합니다.
