# Channel Vault NAS Product Brief

작성일: 2026-05-30

## One-Line Definition

Channel Vault NAS는 개인 NAS에서 동작하는 채널 아카이브 매니저다. 사용자가
YouTube 채널이나 플레이리스트를 등록하면 주기적으로 새 영상을 감지하고,
정책에 따라 다운로드하며, 메타데이터, 자막, 썸네일을 보관하고, UI에서
탐색, 분석, 스트리밍할 수 있게 한다.

## Why This Is a New Project

기존 `youtube-dl-nas` v1은 URL을 넣고 다운로드하는 NAS용 큐 앱이다. 신규
개편 코드에는 FastAPI, React, SQLite, JWT 기반 플랫폼이 이미 들어가 있지만,
제품 계약은 여전히 v1의 즉시 다운로드 경험에 강하게 묶여 있다.

Channel Vault NAS는 다운로드 큐의 다음 화면이 아니라 채널 단위 수집, 보관,
탐색, 분석, 스트리밍을 다루는 별도 제품이다. 따라서 기존 v1 레포와 Docker
사용자는 보존하고, 이 레포에서는 새 제품 구조로 간다.

## Repository Strategy

- `youtube-dl-nas`: v1 LTS. 기존 Docker 사용자 보호.
- `channel-vault-nas`: 새 제품. 채널 아카이브, sync, 분석, 스트리밍 중심.

Docker 이미지 방향:

- v1: `modenaf360/youtube-dl-nas:latest`
- 새 앱: `modenaf360/channel-vault-nas:beta` 또는
  `modenaf360/channel-vault-nas:latest`

v1 README에는 상단에 새 프로젝트 링크만 추가한다. v1 기본 설치 명령과 Docker
`latest`는 바꾸지 않는다.

## Product Positioning

Channel Vault NAS는 다운로더가 아니라 개인 채널 아카이브다.

제품 프레이밍은 creator-owned media, user-authorized channel backup,
Google Takeout import, 기존 NAS 폴더 scan이다. 사용자가 보관할 권리나 허가를
가진 콘텐츠를 안전하게 정리하고 복원 가능하게 만드는 도구로 둔다.

사용자 관점의 핵심 질문:

- 내가 등록한 채널에 새 영상이 올라왔는가?
- 어떤 영상이 내려받아졌고 어떤 영상이 실패했는가?
- 채널별 저장 공간은 얼마나 쓰고 있는가?
- 업로드 주기, 영상 길이, 키워드, 자막 흐름은 어떤가?
- 내려받은 영상을 NAS 안에서 바로 찾고 스트리밍할 수 있는가?

## Core User Flow

1. 사용자가 채널 또는 플레이리스트 URL을 등록한다.
2. 앱이 채널 메타데이터와 영상 목록을 수집한다.
3. 정해진 주기에 따라 sync job이 새 영상을 감지한다.
4. 채널별 정책에 맞춰 다운로드 여부와 품질을 결정한다.
5. 다운로드 중 상태, 실패, 재시도, 완료가 실시간으로 표시된다.
6. 완료된 영상은 라이브러리에서 검색, 필터, 스트리밍할 수 있다.
7. 채널별 업로드 패턴, 영상 길이, 키워드, 저장 용량을 분석한다.

보조 진입 흐름:

- Google Takeout export를 가져와 채널 폴더와 sidecar를 인덱싱한다.
- 기존 NAS/외장하드 폴더를 scan해서 `Video`, `MediaFile`, `Subtitle`로 복원한다.
- 권한 있는 채널 sync는 source coverage와 fidelity를 유지하는 용도로 사용한다.

## MVP Scope

첫 릴리스에서 필요한 기능:

- 로컬 계정 로그인
- 채널/플레이리스트 등록
- 수동 sync
- 주기적 sync scheduler
- 새 영상 감지
- 채널별 다운로드 정책
- 다운로드 큐와 진행률
- 영상 메타데이터 저장
- 썸네일 저장 또는 캐싱
- 자막 다운로드 옵션
- 라이브러리 목록
- 영상 파일 스트리밍
- 실패 작업 재시도
- 기본 설정 화면

MVP에서 미뤄도 되는 기능:

- 고급 분석 대시보드
- 자동 태그 분류
- 자막 전문 검색
- 다중 사용자 권한
- 외부 알림 연동
- 모바일 앱
- 클러스터/분산 다운로드

## Information Architecture

첫 화면은 다운로드 폼이 아니라 채널 운영 콘솔이어야 한다.

- `Dashboard`: 새 영상, 진행 중 sync, 실패 작업, 저장소 사용량, 최근 완료.
- `Channels`: 등록 채널 목록, 마지막 sync, 새 영상 수, 정책, 상태.
- `Channel Detail`: 영상 타임라인, 다운로드 정책, 업로드 패턴, 자막/메타데이터 상태.
- `Library`: 내려받은 영상 탐색, 검색, 필터, 태그, 스트리밍.
- `Insights`: 채널별 업로드 주기, 길이 분포, 키워드/자막 분석, 저장 용량 추세.
- `Queue`: 다운로드, 메타데이터 수집, 자막 작업 큐.
- `Settings`: 저장 경로, 품질 정책, sync 주기, 인증, yt-dlp 옵션.

보조 기능:

- 단일 URL 다운로드는 유지할 수 있지만 메인 기능으로 두지 않는다.
- 기존 `youtube-dl-nas`의 즉시 다운로드 경험은 `Quick Download` 정도로 흡수한다.

## UI/UX Direction

v1 UI는 참고 대상이 아니라 운영 케이스의 근거다. 새 UI는 완전히 새롭게 간다.

UI 원칙:

- 다운로드 앱보다 관리 콘솔에 가깝게 설계한다.
- 첫 화면에서 채널 상태, sync 상태, 실패 작업이 바로 보여야 한다.
- 카드 남발보다 밀도 있고 스캔하기 쉬운 운영 UI를 우선한다.
- 단순한 admin panel이 아니라 아름다운 archive observatory처럼 느껴져야 한다.
- D3.js, Recharts, Framer Motion 등을 적극적으로 써서 동적이고 시각적인
  데이터 화면을 만든다.
- 저장소, sync, queue, 채널 건강도, 자막/키워드 흐름은 그래프로 이해될 수
  있어야 한다.
- 채널, 영상, 작업 큐, 저장소 상태가 명확히 구분되어야 한다.
- 반복 사용자가 빠르게 상태를 확인하고 조치할 수 있어야 한다.

시각 참고:

- `https://hyeonsangjeon.github.io/gdpval-realworks/`
- 다크 대시보드, KPI 카드, mono 숫자, subtle motion, chart-heavy UI 감각을
  참고하되 Channel Vault NAS의 미디어 아카이브 도메인에 맞춰 더 창의적으로 간다.

v1에서 참고할 것:

- yt-dlp 옵션과 실패 케이스
- 해상도, audio, subtitle 선택 로직
- WebSocket 진행률 표시 경험
- `download_history.json`에 담긴 히스토리 필드
- Docker 환경변수와 NAS 배포 방식
- 파일명 sanitizing
- `.incomplete` 폴더
- proxy 지원
- yt-dlp 업데이트 scheduler

v1에서 버릴 것:

- 단일 URL 입력 중심 첫 화면
- 문자열 기반 WebSocket 이벤트
- `Auth.json` 중심 설정 모델
- 히스토리 테이블 하나에 모든 것을 넣는 구조
- Bootstrap/jQuery 스타일 UI

## Platform Inheritance

새 앱은 `youtube-dl-nas` v1을 그대로 마이그레이션하지 않지만,
`youtube-dl-nas` `origin/develop`의 FastAPI/React 플랫폼 작업은 이어받는다.

이어받을 기반:

- `pydantic-settings` 기반 환경 설정
- `DATABASE_URL`로 교체 가능한 SQLite 우선 DB 설정
- SQLAlchemy async engine/session 패턴
- Alembic migration 기반
- JWT access/refresh token 인증 흐름
- FastAPI dependency 기반 protected API
- React `AuthContext`와 axios token refresh interceptor
- FastAPI lifespan에서 worker/scheduler를 시작하고 종료하는 구조
- JSON WebSocket broadcast 흐름
- yt-dlp subprocess wrapper와 progress parser

새로 설계할 영역:

- `Download` 단일 테이블 중심 구조를 `Channel`, `Video`, `DownloadJob`,
  `SyncJob`, `MediaFile`, `Subtitle`, `ChannelPolicy`로 분리한다.
- URL 다운로드 중심 API를 채널 sync, 라이브러리, 큐, 스트리밍 API로 확장한다.
- WebSocket 이벤트는 다운로드 진행률뿐 아니라 sync, queue, storage 상태를 담는다.
- 메인 UI는 다운로드 폼이 아니라 운영 콘솔로 구성한다.

## Release Strategy

- `0.1.0-alpha`: 채널 등록, 수동 sync, 메타데이터 저장
- `0.2.0-alpha`: 다운로드 큐, 진행률, 기본 라이브러리
- `0.3.0-beta`: 자동 sync, 스트리밍, 기본 설정
- `1.0.0`: Docker 배포, 기본 문서, 안정성 검증
