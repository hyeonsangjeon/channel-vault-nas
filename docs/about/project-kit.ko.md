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

Channel Vault NAS는 YouTube 채널을 NAS에 백업하고, 기존 미디어와 `archive.txt`를
재사용하며, 없는 영상만 다운로드하고, 디스크 파일에서 검색 색인을 다시 만들 수
있는 오픈소스 Docker 콘솔입니다.

## 짧은 디렉터리 설명

YouTube 채널을 Docker NAS에 백업합니다. 기존 미디어와 `archive.txt`를 가져오고,
누락 또는 건너뜀 판단을 확인하며, 제한된 `yt-dlp` 다운로드를 예약하고, 마운트된
폴더와 사이드카에서 라이브러리 색인을 복구합니다.

## 검증된 정보

| 항목 | 현재 값 |
| --- | --- |
| 라이선스 | [MIT](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/LICENSE) |
| 소스 | [GitHub](https://github.com/hyeonsangjeon/channel-vault-nas) |
| 현재 릴리스 | [`v0.1.0-alpha.3`](https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.1.0-alpha.3) |
| 첫 공개 릴리스 | 2026년 6월 11일 |
| 배포 방식 | 두 Docker 이미지와 하나의 Compose 파일 |
| 아키텍처 | `linux/amd64`, `linux/arm64` |
| 공개 레지스트리 | [Docker Hub API](https://hub.docker.com/r/modenaf360/channel-vault-nas-api), [web](https://hub.docker.com/r/modenaf360/channel-vault-nas-web) |
| 영구 저장소 | 메타데이터, 아카이브 미디어, 런타임 설정용 개별 바인드 마운트 |
| 다운로드 엔진 | API 이미지의 `yt-dlp`, `ffmpeg`, `ffprobe` |
| UI 언어 | 영어, 한국어, 일본어, 중국어 간체, 힌디어 |
| 권장 네트워크 | localhost, 사설 LAN/VPN, 신뢰할 수 있는 인증 리버스 프록시 |

## 차별점

- 기존 NAS 미디어, 자막, 썸네일, `info.json` 사이드카를 일부러 다시 받지 않고
  색인할 수 있습니다.
- `archive.txt` 판단이 명령행 옵션 안에 사라지지 않고 다운로드됨, 없음, 대기,
  건너뜀 상태로 남습니다.
- 파일시스템은 영구 아카이브이고 SQLite는 백업하거나 재구축할 수 있는 검색
  색인입니다.
- 채널 등록과 실제 다운로드가 분리되어 있습니다. 운영자가 자동 백업을 시작한
  뒤에만 다운로드가 실행됩니다.

TubeArchivist, Pinchflat, TubeSync, ytdl-sub가 더 잘 맞는 경우는 [솔직한 워크플로
비교](comparison.md)를 참고하세요.

## 미디어 자료

아래 자료는 현재 `alpha.3` 흐름을 보여주며 프로젝트 링크와 출처를 함께 표시하면
소개 글에 사용할 수 있습니다.

- [1280x640 소셜 프리뷰](../assets/social-preview.png)
- [240x240 프로젝트 아이콘](../assets/producthunt-thumbnail.png)
- [자동 백업 화면](../assets/screenshots/channel-downloads.png)
- [채널 등록 화면](../assets/screenshots/channel-registration.png)
- [기존 아카이브 가져오기](../assets/screenshots/existing-archive-import.png)
- [대시보드 개요](../assets/screenshots/dashboard-cockpit.png)
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
