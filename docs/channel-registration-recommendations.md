# Channel Registration MVP — Recommendations (창의·차별화·UIUX)

작성일: 2026-05-30
상태: 권고 (recommendations only). 강제 스펙 아님 — Codex가 10시간 자율 작업에서
재량껏 더 멋지게 밀어붙이라고 쓰는 문서.
목표: **Channel Registration을 진짜 end-to-end로** 돌리되, 다른 앱엔 없는
경험과 미친듯이 예쁜 UI로 만든다.
전제 문서: `archive-priorities.md`(데이터/폴더 계약), `design-direction.md`(비주얼),
`architecture.md`(플랫폼).

## 현재 코드 기준 (이 위에서 올린다)

이미 있는 발판 — 새로 만들지 말고 **진짜로 연결**할 것:

- `services/source_normalizer.py` → 스마트 URL 해석의 씨앗
- `services/storage_guard.py` → 저장 용량 예측 hook
- `services/archive_rescan.py` → "파일시스템이 source of truth" 재스캔
- `models/archive.py`, `schemas/{archive,source,library}.py` → 도메인 스키마
- `routers/{channels,imports,library}.py` → API 표면
- frontend mock: `folderPreview`, `uploadRhythm`, `backupStats`, `fidelityChecks`,
  `importOptions` (observatory.ts) + `ChannelConstellation` / `MetricTile` / `QueueFlow`

즉 개념은 mock으로 살아있다. 이번 슬라이스의 본질은 **mock → 실제 yt-dlp probe →
DB 영속화 → 살아있는 UI** 로 한 줄기를 관통시키는 것.

---

## 북극성 한 줄

> Channel 등록은 "폼 제출"이 아니라 **관측소에 별 하나를 점화하는 순간**이다.
> 붙여넣는 순간 채널이 살아 움직이며 자기를 드러내고, 사용자는 **눈 뜨고**
> 아카이빙을 시작한다.

다른 앱은 URL 넣으면 리스트에 행 하나 추가되고 끝이다. 우리는 등록 자체를
**제품의 첫 마법 순간**으로 만든다.

## End-to-end 계약 (최소한 이게 돌면 성공) [Core]

```
[붙여넣기] → [Probe(미리보기)] → [정책 선택] → [점화(commit)] → [목록/상세]
```

1. 사용자가 URL/handle을 붙여넣는다.
2. **commit 전에** yt-dlp flat probe(`--flat-playlist`, 다운로드 없음)로 채널
   메타 + 영상 목록 개수를 가져와 **미리보기 카드**를 보여준다.
3. 백필 범위 + 화질/자막 정책을 고른다 (저장량 예측과 함께).
4. 확정 시 `Channel` + `Video`(목록) 영속화, `SyncJob`(probe) 기록.
5. 채널이 목록과 constellation에 나타나고, 상세에서 coverage·cadence·타임라인을
   본다 (아직 다운로드 0개여도 "0 / 342 보관"으로 보임).

이 다섯 단계가 mock 없이 실제로 흐르면 end-to-end 달성. 나머지는 전부 그 위의
연출과 차별화다.

## 절대 막히면 안 되는 기술 제약 [Core]

- **yt-dlp는 이벤트 루프를 블록하지 않게** — `asyncio.create_subprocess_exec`로
  비동기. probe는 별도 job으로 돌리고 WebSocket으로 진행 보고.
- **probe와 full sync 분리** — 등록 미리보기는 flat·빠름. 전체 메타 수집은 이후.
- **archive-priorities.md의 계약 준수** — `published_at`(시각), `upload_date`
  앵커, `.info.json` sidecar, `source_state` lifecycle, `relative_path`,
  coverage 집계. 등록 단계에서 이 필드들을 처음부터 채운다.
- **path safety** — 폴더명 sanitize(Windows 금지문자 포함), 길이 cap, traversal 차단.
- **i18n 5개 언어** — 새 UI 문자열 전부 `locales/{en,ko,ja,zh,hi}.json`에. 하드코딩 금지.
- **다크 옵저버토리 토큰 재사용** — 새 팔레트 만들지 말 것.

---

## 차별화 기능 — 다른 앱(TubeArchivist/PinchFlat/MeTube)에 없는 것

### 1. Live Probe Preview — "사기 전에 본다" [Core]
붙여넣는 즉시 commit 전에 채널 정체가 드러난다: 아바타·배너·**총 영상 수**·
첫/마지막 업로드·예상 케이던스 sparkline. 경쟁 앱은 일단 등록하고 나서야 안다.
우리는 **등록 전에** 보여준다. 이게 미친듯이 예쁜 핵심 순간.

### 2. Storage Forecast at Registration [Core]
`storage_guard`를 실제로 물려서: "342개를 1080p로 받으면 ≈ 84 GB. NAS 여유
1.2 TB." 화질을 바꾸면 숫자가 실시간으로 변한다. 등록 시점에 돌아가는 policy
simulator는 어디에도 없다.

### 3. Backfill Timeline Scrubber [Extension]
"전체 / 지금부터 / 최근 N개 / 특정 날짜 이후"를 **타임라인 위 스크러버**로 드래그.
끌면 받을 개수와 GB가 살아서 갱신. 저장 공간을 존중하는 의식적 백필.

### 4. "예상 폴더 구조" 미리보기 — 커밋 전 신뢰 [Extension·강력 추천]
`folderPreview` mock을 실제 계약(archive-priorities Option B)으로 렌더:
커밋 전에 **"이 채널이 NAS의 정확히 어디에, 어떤 이름으로 떨어질지"** 트리로 보여줌.
NAS 사용자가 앱을 신뢰하는 결정적 순간. 폴더가 계약이라는 우리 입장의 시각적 증거.

### 5. Smart URL Understanding [Core]
`source_normalizer`를 키워서: 채널 URL·`@handle`·영상 URL("이 채널 통째로
받을까요?" 제안)·플레이리스트·공유 링크 전부 해석·정규화·중복 감지(이미 등록됨?).
지저분한 입력에도 안 깨지는 건 의외로 경쟁 앱이 못한다.

### 6. Coverage-first, t=0부터 [Core]
다운로드 0개여도 첫 화면부터 "0 / 342 보관 (0%)". 진행률 막대가 아니라
**완전성**을 1급으로. 등록 순간부터 아키비스트 마인드셋을 심는다.

### 7. Tombstone Promise, 등록 시점에 약속 [Extension]
등록 카드에 한 줄: "지금부터 지켜봅니다. 영상이 사라지면, 당신에겐 남습니다."
`source_state` lifecycle의 감정적 약속을 첫 순간에 건다.

### 8. Live Metadata Streaming [Extension]
probe를 WebSocket 잡으로: flat 목록이 enumerate되며 **영상 카운터가 실시간으로
째깍째깍 올라간다**. 등록이 살아있는 느낌. `QueueFlow` 연출 재사용.

---

## "미친듯이 이쁘게" — 등록 연출(choreography) [Core 비주얼 바]

등록 한 번을 영화처럼:

1. **Command bar** — 평범한 input 금지. 포커스 시 은은히 빛나는(glow) 소환 바.
   카피: "Summon a channel into your vault." mono 입력 텍스트.
2. **Probe 중** — 스켈레톤 → 메타데이터가 stagger로 materialize (Framer Motion).
   배너를 blur 처리해 카드 뒤 ambient 배경으로.
3. **Preview 카드** — 아바타 미세 parallax, **mono 숫자 count-up**(총 영상 수·
   GB·일수), cadence sparkline, storage forecast 게이지. 정보 밀도 높지만 정돈.
4. **점화(commit)** — 확정하면 채널이 **constellation으로 ignite**: 노드가
   태어나고 엣지가 그려짐. 이 한 방의 모션이 제품의 시그니처.
5. **Channels 빈 상태** — 슬픈 "no data" 금지. 초대하는 starfield + "첫 별을
   점화하세요."
6. 상태 전이(probe→preview→정책→점화)는 abrupt redraw 대신 **애니메이션 전환**.

기존 컴포넌트를 재사용해 일관성 유지: `ChannelConstellation`(점화 대상),
`MetricTile`(미리보기 KPI), `QueueFlow`(라이브 probe), 다크 토큰·semantic accent.

## 비차별 함정 — 하지 말 것

- 평범한 "URL 입력 → 리스트 행 추가" 폼 (그게 경쟁 앱 전부다)
- probe를 동기로 돌려 UI 프리징 / 이벤트 루프 블록
- 하드코딩 영어 문자열 (i18n 5개 언어 깨짐)
- 새 색 팔레트·카드 남발 (옵저버토리 일관성 파괴)
- 미리보기 없이 바로 commit (우리 차별점을 버리는 것)
- DB만 채우고 폴더 계약/sidecar 무시 (재import·복원 보험 상실)

## 10시간 추천 진행 순서 (권고일 뿐, 항상 도는 상태 유지)

1. `Channel`/`Video` 실제 영속화 + Alembic 마이그레이션 (mock 제거 경로 확보)
2. `source_normalizer` 실제 URL 해석 + `POST /api/channels` probe 모드
3. yt-dlp flat probe 서비스 (async subprocess) → 미리보기 payload
4. 프론트 등록 플로우: command bar → probe preview 카드 (mock 자리 교체)
5. 정책 선택 + `storage_guard` 실제 forecast
6. commit → 영속화 → constellation ignite + Channels 목록 실데이터
7. Channel Detail: coverage·cadence·타임라인 (실데이터)
8. WebSocket 라이브 probe / 폴더 구조 미리보기 (시간 남으면 Extension)

각 단계 끝에 **항상 실행 가능한 상태**로 커밋. 한 번에 다 갈아엎지 말 것.

## 열린 질문 (Codex 판단)

1. probe를 동기 응답(빠른 채널은 즉답)으로 줄까, 처음부터 WebSocket 잡으로
   통일할까? — 큰 채널 enumerate가 길어서 잡 권장, 단 작은 채널 즉답 fast-path 가능.
2. 백필 범위 선택(권고 3)을 이번 슬라이스에 넣을까, 0.2.0으로 미룰까? — 등록
   경험의 차별점이라 가능하면 early, 단 Core는 "전체/지금부터" 2택으로 단순화 가능.
3. 폴더 구조 미리보기(권고 4)를 실제 trial-run으로 만들까, 계산된 미리보기로만
   둘까? — MVP는 계산된 미리보기 권장(파일 생성 없이 신뢰만 전달).
