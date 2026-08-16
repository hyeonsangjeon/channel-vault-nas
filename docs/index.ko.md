---
title: NAS용 YouTube 채널 백업
description: >-
  YouTube 채널을 Docker NAS에 백업합니다. archive.txt와 기존 미디어를
  재사용하고 없는 영상만 다운로드하며 디스크에서 색인을 복구합니다.
hide:
  - navigation
---

# Channel Vault NAS

**이미 가진 아카이브를 버리지 않고 YouTube 채널을 NAS에 백업합니다.** 채널 URL을
붙여넣고 기존 미디어와 `archive.txt`를 재사용하면 `yt-dlp`가 없는 영상만 받습니다.
검색용 SQLite 색인을 다시 만들어야 해도 미디어 파일은 그대로 남습니다.

[60초 만에 설치 :material-rocket-launch:](install/index.md){ .md-button .md-button--primary }
[기존 아카이브 가져오기 :material-folder-sync:](usage/migrate-existing-archive.md){ .md-button }
[GitHub에서 소스 보기 :fontawesome-brands-github:](https://github.com/hyeonsangjeon/channel-vault-nas){ .md-button }

---

## 일반 다운로드 큐가 놓치는 부분

<div class="grid cards" markdown>

-   :material-folder-check:{ .lg .middle } __기존 아카이브 유지__

    ---

    NAS에 이미 있는 영상, 썸네일, 자막, `info.json` 사이드카를 색인합니다. 이름을
    바꾸거나 일부러 다시 받지 않습니다.

    [:octicons-arrow-right-24: 가져오기 가이드](usage/migrate-existing-archive.md)

-   :material-format-list-checks:{ .lg .middle } __건너뜀 판단 확인__

    ---

    다운로드됨, 없음, 대기, 건너뜀 상태가 명령행 옵션 안에 숨지 않고 화면에
    표시됩니다.

    [:octicons-arrow-right-24: archive.txt 가져오기](usage/archive-txt.md)

-   :material-database-refresh:{ .lg .middle } __디스크에서 복구__

    ---

    미디어는 영구 데이터입니다. SQLite는 백업하거나 마운트된 폴더와 사이드카에서
    다시 만들 수 있는 검색용 색인입니다.

    [:octicons-arrow-right-24: 파일시스템 규칙](reference/filesystem.md)

-   :material-calendar-sync:{ .lg .middle } __한 번 설정하고 자동 백업__

    ---

    간격과 한 번에 받을 영상 수를 고르고 자동 백업을 시작하거나 같은 화면에서
    일시정지합니다.

    [:octicons-arrow-right-24: 첫 백업](usage/first-backup.md)

</div>

---

## 첫 백업은 한 화면에서 끝납니다

**홈**에서 **채널 등록**을 누르고 원본을 붙여넣은 뒤 **채널 확인**, **채널 등록**
순서로 진행합니다. 채널 화면에는 **총 영상 / 다운받음 / 남은 영상**이 한 번만
표시되고, 핵심 버튼도 **자동 백업 시작** 하나입니다. 다운로드 간격, 한 번에 받을
개수, 다음 실행, 일시정지가 같은 곳에 있습니다.

[![Channel Vault NAS 채널 백업 화면](assets/screenshots/channel-downloads.png)](usage/first-backup.md)

[클릭 단위 안내 시작 :material-arrow-right:](usage/first-backup.md){ .md-button .md-button--primary }

---

## 왜 필요한가요

대부분의 다운로드 도구는 한 가지 질문에만 답합니다. *"이 URL을 받을 수 있나?"*

Channel Vault NAS는 NAS 운영자의 질문에 답합니다.

> "무엇이 바뀌었고, 무엇이 이미 아카이브됐고, 다음에 안전하게 받을 것은
> 무엇이며, 앱 데이터베이스가 사라져도 아카이브를 복구할 수 있는가?"

파일시스템이 영구 아카이브로 남고 SQLite는 그 위의 색인입니다. 기존 NAS 폴더를
다시 스캔하면 파일을 하나도 옮기지 않고 색인됩니다.

### 모든 다운로더를 대신하려는 앱은 아닙니다

성숙한 미디어 서버 경험이 가장 중요하면 TubeArchivist, 단순한 구독 다운로드가
중요하면 Pinchflat, 기존 NAS 아카이브와 건너뜀 판단, 디스크 복구가 중요하면
Channel Vault가 잘 맞습니다.

[워크플로 솔직하게 비교하기 :material-compare:](about/comparison.md){ .md-button }

!!! warning "셀프 호스팅 가드레일"
    이 셀프 호스팅 릴리스는 localhost, 사설 LAN, VPN, 또는 신뢰할 수 있는
    리버스 프록시를 위해 만들어졌습니다. 공개 인터넷에 직접 노출하지 **마세요**.
    [액세스 토큰](install/access-token.md)과
    [NAS 설치 가이드](install/nas.md)를 참고하세요.

---

## 레지스트리 & 링크

API 이미지와 웹 이미지는 함께 동작하며, Compose 설치가 두 이미지를 모두 받습니다.
하나로 합친 단일 이미지는 없습니다.

- Docker Hub API 이미지: [`modenaf360/channel-vault-nas-api`](https://hub.docker.com/r/modenaf360/channel-vault-nas-api)
- Docker Hub 웹 이미지: [`modenaf360/channel-vault-nas-web`](https://hub.docker.com/r/modenaf360/channel-vault-nas-web)
- GHCR 미러: [`ghcr.io/hyeonsangjeon/channel-vault-nas-api`](https://github.com/hyeonsangjeon/channel-vault-nas/pkgs/container/channel-vault-nas-api) 및 [`…-web`](https://github.com/hyeonsangjeon/channel-vault-nas/pkgs/container/channel-vault-nas-web)
- 소스: [`github.com/hyeonsangjeon/channel-vault-nas`](https://github.com/hyeonsangjeon/channel-vault-nas)
