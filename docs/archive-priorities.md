# Channel Vault NAS — Archive Priorities (Creator & Archivist Lens)

작성일: 2026-05-30
상태: 권고 (proposal). Codex가 읽고 도메인/폴더/대시보드에 반영할지 판단할 것.
관점: system architecture + UX. 누가 이 앱을 진지하게 쓰는가에서 역산.

## 이 문서의 목적

`design-direction.md`는 이미 "Creator And Fan Questions"를 잘 던졌다. 그런데 그
질문들은 지금 **UI 카피**로만 존재하고, 그 질문에 답할 수 있게 해주는 **데이터
모델·폴더 구조·API**는 아직 없다. 예: "총 영상 몇 개 중 몇 개를 보관했나?"를
화면에 띄우려면 `Channel`에 `source_video_count`가 있어야 하는데 현재 스키마엔
없다. 이 문서는 그 다리를 놓는다.

핵심 주장 한 줄:

> Channel Vault NAS의 진짜 사용자는 "다운로더를 쓰는 사람"이 아니라
> **"사라질까 봐 불안한 아키비스트"** 다. 제품의 1급 지표는 진행률(progress)이
> 아니라 **완전성(coverage)** 과 **충실도(fidelity)** 다.

## 사용자는 누구인가 (3 archetypes)

1. **자기 채널을 백업하는 유튜버 (creator)**
   - 가장 큰 공포: 스트라이크/계정 정지/실수 삭제로 내 작업물이 통째로 날아감.
   - 원하는 것: **재업로드 가능한 수준의 완전 복제**. 원본 제목/설명/태그/챕터/
     업로드 시각/내가 만든 썸네일/내가 쓴 자막까지 그대로.
   - 메타데이터가 곧 자산이다. 영상 파일만으론 부족하다.

2. **좋아하는 채널을 박제하는 골수팬 (archivist)**
   - 가장 큰 공포: 채널이 내려가거나, 옛 영상이 비공개/삭제됨 (음악 DMCA, 창작자
     정리 등 매우 흔함).
   - 원하는 것: **사라지기 전에 잡기**, 그리고 사라진 뒤에도 "내겐 있다"는 증거.
   - 원본 업로드 날짜가 살아있어야 진짜 타임라인이 된다.

3. **NAS 운영자 (operator)** — 위 둘과 겹치며, 추가로:
   - 앱 없이도 파일을 신뢰하고 싶다. Finder/SMB/Plex/Jellyfin에서 바로 열려야 한다.
   - 폴더 구조가 예측 가능해야 앱 밖에서도 쓸 수 있다.

세 명 모두의 공통 본능: **"내 사본은 얼마나 완전한가, 그리고 앱이 죽어도
남는가."**

## 아키비스트의 3대 질문 → 현재 모델의 빈틈

| 사용자 질문 | 답하려면 필요한 데이터 | 현재 상태 |
|---|---|---|
| 이 채널 총 영상 몇 개인가? | `Channel.source_video_count` | ❌ 없음 |
| 그중 몇 개를 내가 가졌나? (= 완전성) | archived / missing / removed 집계 | ❌ 없음 |
| 언제 올렸나 / 다음은 언제? (= 케이던스) | 원본 `published_at`(시각 포함), 케이던스 캐시 | △ 날짜만, 시각·케이던스 없음 |
| 사라진 영상도 내겐 있나? | source lifecycle + tombstone | △ `availability` 필드만, 보존 규칙 없음 |
| 파일이 어디에, 어떤 규칙으로? | 예측 가능 폴더 + sidecar 메타데이터 | △ 레이아웃 초안만, 계약 수준 아님 |

아래 5개 권고가 이 빈틈을 메운다.

---

## 권고 1 — Coverage(완전성)를 1급 지표로 승격 [Core]

진행률 막대는 "지금 받는 중인 1개"를 보여준다. 아키비스트가 보고 싶은 건
"**전체 중 안전한 비율**"이다.

대시보드 상단의 헤드라인 숫자는 이래야 한다:

```
이 채널: 342개 중 318개 보관 (93%) · 미보관 21 · 원본삭제·보존 3
전체 아카이브: 추적 12,400개 중 11,980개 안전 (96.6%)
```

필요한 것:

- `Channel.source_video_count` — 마지막 sync 때 소스가 보고한 전체 개수.
- 파생 집계: `archived_count`, `missing_count`(소스엔 있는데 로컬엔 없음),
  `removed_saved_count`(소스에서 사라졌지만 로컬 보존됨). 대시보드 속도를 위해
  `Channel`에 캐시하고 sync 끝에 갱신.
- 신규 API:
  - `GET /api/channels/{id}/coverage` → `{source, archived, missing, removed, percent}`
  - `GET /api/channels/{id}/missing` → 미보관 영상 목록 (한 번에 받기 버튼 연결)

UX: `missing`은 숨기지 말고 액션 가능한 리스트로. 아키비스트의 to-do다.

## 권고 2 — Fidelity(원본 충실도): 메타데이터가 자산이다 [Core]

특히 creator 페르소나에게 mp4 파일 하나는 절반의 백업이다. 재업로드/복원하려면
원본 메타데이터가 통째로 필요하다. yt-dlp는 `--write-info-json`으로 전부 뱉는다.

원칙: **모든 영상 옆에 `.info.json` sidecar를 항상 쓴다.** 이게 DB가 날아가도
복원 가능하게 하는 보험이자, "기존 폴더 재import"를 거의 공짜로 만드는 열쇠다.

`Video`에 보존/추가할 필드:

- `published_at` — 날짜만이 아니라 **원본 업로드 시각까지** (가능한 경우).
- `upload_date` (date) — 폴더/파일명 prefix용 안정 키.
- `tags` (json), `categories` (json), `chapters` (json)
- `is_short`, `is_live`, `was_livestream` — Shorts/라이브/일반 구분
- `info_json_path` — sidecar 위치

creator가 특히 원하는 것 (Extension로 단계화 가능):

- 본인이 올린 **커스텀 썸네일 maxres** 저장 (단순 캐시 아님).
- 본인이 **직접 작성한 자막**과 **자동 생성 자막**을 구분 저장
  (`Subtitle.auto_generated`는 이미 있음 — 살리자).
- 댓글 보존은 [Later/Explore] — 커뮤니티·기억 가치가 큰 페르소나가 있음.

## 권고 3 — 폴더 구조는 구현 디테일이 아니라 "계약"이다 [Core]

NAS 사용자는 앱을 안 거치고 파일을 직접 뒤진다. 그래서 레이아웃은 다음을
보장해야 한다:

1. **앱 독립성** — Finder/SMB/Plex/Jellyfin에서 그대로 의미 있게 열린다.
2. **안정 앵커** — YouTube에서 제목이 바뀌어도 파일이 안 움직인다. 불변 키는
   `upload_date` + `video_id`. 절대 제목만으로 앵커하지 않는다.
3. **시간 정렬** — 파일 브라우저에서 업로드순 정렬되게 `YYYY-MM-DD` prefix.
4. **자기 기술성(self-describing)** — sidecar(.info.json/자막/썸네일/.nfo)가
   미디어 바로 옆에. 폴더 하나만 복사해도 모든 게 따라온다.
5. **크로스 플랫폼 안전** — Windows 금지문자 제거, 길이 cap(멀티바이트 한/일
   제목 + 경로 합산 주의), emoji sanitize, 그래도 `video_id`는 파일명에 유지.

### 추천 레이아웃 — Option B: per-video 폴더 (default 권장)

```text
downfolder/
  channels/
    {channel_handle} [{channel_id}]/
      channel.nfo                 # Plex/Jellyfin 채널 메타
      poster.jpg
      _channel.info.json          # 원본 채널 메타 sidecar
      2024/                       # 연도 버킷: 10년 채널도 폴더가 안 터짐
        2024-01-15 - sanitized-title [{video_id}]/
          video.mp4
          video.info.json         # ★ 복원 보험
          video.en.srt
          video.ko.srt
          thumbnail.jpg
          video.nfo               # Plex/Jellyfin 영상 메타 (Extension)
```

- 장점: 영상마다 자기완결 폴더 → 하나 복사 = 전부 따라옴. Plex/Jellyfin의
  "movie folder" 관례와 일치. 연도 버킷으로 디렉터리 비대화 방지.
- 단점: 디렉터리/경로 깊이 증가.

### 대안 — Option A: 채널당 flat (가벼움)

```text
downfolder/channels/{channel_handle} [{channel_id}]/videos/
  2024-01-15__{video_id}__sanitized-title.mp4
  2024-01-15__{video_id}__sanitized-title.info.json
  2024-01-15__{video_id}__sanitized-title.en.srt
```

- 장점: 단순, 디렉터리 적음.
- 단점: 영상당 4~6개 파일 × 수천 = 폴더 과밀, 미디어 서버 친화도 낮음.

### 레이아웃 불변식 (어느 옵션이든 지킬 것)

- 파일/폴더 앵커 = `{upload_date}` + `{video_id}`.
- `.info.json` sidecar는 항상 기록.
- 소스 제목 변경 시 기본은 **rename 안 함**; rename은 명시적·추적되는 액션.
- `MediaFile.relative_path`(볼륨 상대경로)를 계약으로 저장. 절대경로는 NAS
  마운트 위치가 바뀌면 깨진다.

> 레이아웃 자체를 Settings에서 템플릿으로 고를 수 있게 하는 건 [Extension].
> MVP는 Option B 하나로 고정해도 충분하다.

## 권고 4 — 사라짐 감지 & Tombstone: 아카이브의 감정적 보상 [Core-ish]

소스에서 영상이 비공개/삭제되는 순간이 이 앱이 존재하는 이유다. 그 순간을
**잡고, 알리고, 로컬 사본은 절대 지우지 않아야** 한다.

`Video.source_state` lifecycle 도입:

```
available → unlisted → private → removed / blocked / deleted
```

- `last_seen_in_source_at` — sync 때 소스 목록에 보였던 마지막 시각.
- `removed_detected_at` — 사라짐을 처음 감지한 시각.
- 규칙: 소스에서 사라져도 `MediaFile`은 보존. UI 배지 "원본 삭제 전 보관됨".
- 신규 API: `GET /api/channels/{id}/removed` — "내가 지켜낸 것들" 트로피 케이스.

이건 단순 기능이 아니라 제품의 서사다. "YouTube엔 없지만 내겐 있다"가
아키비스트가 이 앱을 사랑하게 되는 지점이다.

## 권고 5 — 업로드 케이던스: "언제 올렸나 / 다음은 언제" [Core 지표, Explore 시각화]

사용자 질문 "언제 영상을 올렸는지"는 두 층이다: (a) 개별 업로드 시각의 충실
보존(권고 2), (b) 패턴.

`Channel`에 케이던스 캐시 (sync 끝에 계산):

- `first_video_published_at`, `latest_video_published_at`
- `avg_upload_interval_days`
- `typical_upload_dow`, `typical_upload_hour` (요일/시간대 히스토그램의 모드)

신규 API: `GET /api/channels/{id}/cadence` → 히스토그램 + 평균 간격 +
**다음 업로드 예상**.

UI: design-direction의 sync timeline / cadence chart가 여기 붙는다. 이미 시각화
아이디어는 있으니, 데이터만 받쳐주면 된다.

---

## 도메인 모델 패치 요약 (architecture.md에 반영 제안)

`Channel` (+):
```
handle                     # @veritasium 등, 폴더/표시용
source_video_count         # 소스 보고 전체 개수
source_counts_updated_at
archived_count / missing_count / removed_saved_count   # 대시보드 캐시
first_video_published_at / latest_video_published_at
avg_upload_interval_days / typical_upload_dow / typical_upload_hour
```

`Video` (+):
```
published_at               # 시각까지 보존
upload_date                # 폴더 앵커용 date
source_state               # available|unlisted|private|removed|blocked|deleted
last_seen_in_source_at / removed_detected_at
tags / categories / chapters (json)
is_short / is_live / was_livestream
info_json_path
```

`MediaFile` (+):
```
relative_path              # 볼륨 상대경로 = 계약
container / video_codec / audio_codec / fps / width / height
info_json_path / nfo_path / thumbnail_path
checksum                   # [Later] 무결성 검증 — 아키비스트가 좋아함
```

## 신규/확장 API 요약

```
GET /api/channels/{id}/coverage    # source/archived/missing/removed/percent
GET /api/channels/{id}/missing     # 미보관 영상 (받기 버튼)
GET /api/channels/{id}/removed     # 원본 삭제 전 보존된 영상
GET /api/channels/{id}/cadence     # 업로드 패턴 + 다음 예상
GET /api/dashboard                 # 전체 coverage 한 줄 요약 포함하도록 확장
```

## 레인 분류 (agents README의 Core/Explore/Vision 어휘 사용)

- **Core (지금 릴리스에 필요):** coverage 지표, `.info.json` sidecar 항상 기록,
  안정 폴더 계약(Option B), `source_state` lifecycle + 로컬 보존, 원본 업로드
  시각 보존.
- **Extension (지금 모양만 잡아둘 것):** `.nfo` 생성(Plex/Jellyfin), 폴더
  레이아웃 템플릿화, 케이던스 시각화, 채널 매니페스트로 "폴더만으로 재import".
- **Later (스파이크 후보):** 댓글 보존, 체크섬 무결성 검증, 로컬 시맨틱 검색,
  policy simulator(저장량 예측).

## 아키텍처 입장 한 가지 (Codex가 동의 여부 판단할 것)

> **파일시스템이 source of truth, DB는 인덱스다.**

각 채널/영상 폴더가 sidecar로 자기 기술적이면, DB가 통째로 날아가도 디스크
스캔만으로 라이브러리를 완전히 재구성할 수 있다. 이건 NAS 아카이브에서 강력한
입장이고, agents README에 이미 있는 "import assistant for existing folders"를
거의 공짜로 만든다. architecture.md의 "Post-download filesystem scan to create
MediaFile"을 이 방향으로 강화하자.

## 열린 질문 (Codex 판단 요청)

1. 폴더 default를 Option B(per-video 폴더)로 갈까, Option A(flat)로 갈까?
   — 본 문서는 B 권장. 미디어 서버 호환·자기완결성 때문.
2. coverage 집계를 `Channel`에 캐시할까, 매번 계산할까? — 대시보드 빈도 고려 시
   캐시 권장.
3. `source_state` 도입을 0.1.0-alpha에 넣을까, 0.2.0으로 미룰까? — tombstone이
   제품 서사의 핵심이라 가능하면 early.
4. `.info.json` 항상 기록을 MVP 기본값으로 강제할까? — 본 문서는 강제 권장
   (복원 보험 + 재import 열쇠).
