# Channel Vault NAS — ⭐ Star 전환 폴리싱 피드백

> 작성 목적: 퍼블릭 오픈 1주 차, **트래픽은 최상위인데 star가 안 붙는 문제**를 "awesome-list에서 보고 10분 안에 star를 누르게" 만드는 관점으로 분석.
> 분석 범위: 코드(백엔드/프론트엔드) · 전체 UI/UX(로컬 데모 직접 구동 후 6개 화면 캡처) · README/문서 · 비주얼 자산 · GitHub 레포 메타데이터.
> 검증 방법: 백엔드(FastAPI)+프론트(Vite) 로컬 기동 → 데모 워크스페이스 시드 → Dashboard/Channels/Library/Queue/Insights/Settings + 빈 첫 실행 화면을 직접 사용·캡처. 백엔드 테스트 92개 그린 확인. `gh`로 레포 메타데이터 확인.

---

## 0. 한 줄 결론 (TL;DR)

**제품은 이미 "잘 만든" 수준이다. 문제는 품질이 아니라 "전환(conversion)"이다.**
방문자가 *"이게 뭔지 / 나한테 왜 필요한지 / 얼마나 멋진지"* 를 **첫 10초 안에** 못 잡는다. 가장 큰 누수 3곳:

1. **소셜 링크 미리보기가 기본 회색 카드** (`usesCustomOpenGraphImage: false`) — 유입의 대부분이 Product Hunt/Reddit/Clien/svrforum 같은 **소셜 referrer**인데, 정작 그 링크 카드가 밋밋하다.
2. **README가 너무 길고(804줄/~30KB) "경고·알파·가드레일" 문구가 위쪽을 점령** — 팔기도 전에 겁부터 준다. 정작 실제로 멋진 UI는 손그림 SVG에 가려진다.
3. **차별점·사회적 증거가 묻혀 있음** — "youtube-dl-nas(166★) 제작자의 차세대", "기존 NAS 폴더 재다운로드 없이 인덱싱", "5개국어 UI", "원클릭 안전 데모" 같은 강력한 후킹이 스캔으로 안 보인다.

> 핵심 메시지: **고치는 게 아니라 "보이게" 하는 작업.** 좋은 재료는 다 있다.

---

## 1. 데이터로 본 funnel (공유해준 트래픽 기준)

| 단계 | 수치 | 해석 |
| --- | --- | --- |
| 7일 views | **203** (WoW +175, 포트폴리오 1위 mover) | 상단 유입은 **이미 최상위**. 트래픽 문제 아님 |
| 14일 clones | **264** (93 unique cloners) | 실제로 받아서 돌려보는 사람도 많음 = 관심 진성 |
| referrer | github.com, Google, **Product Hunt, Reddit, Clien, svrforum**, 개인사이트 | **소셜/커뮤니티 중심** → 링크 카드 첫인상이 결정적 |
| repo 페이지 views | 95 (메인), product-brief 9 | 랜딩까지는 오는데 |
| **stars** | **3~4 (30일 증가 0)** | **여기서 전부 샌다** |

대시보드 자체도 이미 진단을 내리고 있음: *"관심 대비 star 전환 낮음 — 30일 175 views인데 stars 증가 0. README 상단 CTA/예제 보강 후보."* → **이 피드백은 그 진단에 대한 구체 실행안.**

비교 기준점: 같은 제작자의 **youtube-dl-nas = 166★**, computing-Korean-STT = 72★. 즉 **이 채널/오디언스는 star를 누를 줄 안다.** channel-vault-nas만 전환이 막혀 있다 → 콘텐츠/포지셔닝 문제임이 더 분명해진다.

---

## 2. 별이 안 붙는 핵심 원인 (우선순위순)

### 🔴 P0-1. 커스텀 소셜 프리뷰(OG) 이미지가 없음 — *가장 싸고 효과 큰 한 방*
- 확인: `gh repo view` → `usesCustomOpenGraphImage: false`.
- 유입의 절대다수가 소셜 referrer인데, 공유될 때 뜨는 건 GitHub 자동 생성 **회색 텍스트 카드**(레포명+설명+숫자). 제품이 얼마나 예쁜지 0% 전달.
- 이미 `docs/assets/producthunt-thumbnail.png`(로고)와 멋진 실제 스크린샷이 있는데 **안 쓰고 있음**.
- **액션:** Settings → Options → **Social preview**에 1280×640 카드 업로드. 카드엔 (a)실제 Dashboard 콕핏 스샷 + (b)한 줄 정의 "Back up your YouTube channels to your own NAS" + (c)"Guarded · Docker · 5 languages" 배지.
- 기대효과: **모든 소셜 노출의 클릭률·체류·star 동시 상승.** 30분 작업, 최고 ROI.

### 🔴 P0-2. README 상단 30초가 "팔지" 못함
현재 위→아래 순서: 로고 → 타이틀 → 태그라인 → **배지 9개** → **손그림 hero SVG** → 15초 GIF → "Start in 60s" → "Registry Links" → "Why it exists" → … → (line 94)에서야 "What Makes It Different".
문제:
- **배지 9개**가 첫 화면을 점령(릴리스/도커탭/도커pulls×2/docs/license/guarded…). 신뢰 신호지만 9개는 과함 → 핵심 3~4개만.
- **hero가 실제 제품이 아니라 SVG 목업.** 이 앱의 최대 무기는 *진짜로 잘 빠진 다크 콕핏 UI*인데 그걸 안 보여줌.
- 스크롤 좀만 내리면 `## Current Status` `## Known Limitations`(line 105~158)에 **"alpha · 노출 금지 · not ready · 단일 사용자 · 토큰은 완전한 인증 아님…"** 경고가 쏟아짐. 사기도 전에 위축.
- **액션(상단 재설계):**
  1. 한 줄 정의(현 태그라인 좋음, 유지) →
  2. **실제 제품 GIF/대표 스샷을 hero로 즉시** (SVG는 폐기 또는 하단) →
  3. **"왜 다른가" 3불릿**(아래 §6 카피 참고) →
  4. **60초 설치 + 한 줄 "원클릭 안전 데모"** →
  5. 그다음에 비로소 스크린샷 그리드/상세.
  - 경고/한계/보안은 **"Security & Scope" 한 섹션으로 묶어 중하단**으로. (지우지 말 것 — 정직함은 자산. 단, 첫인상 자리를 양보.)

### 🔴 P0-3. 차별점·사회적 증거가 묻혀 있음
- **"youtube-dl-nas(166★) 제작자의 차세대 제품"** — 이게 README **794번째 줄**(맨 끝 "Relationship To youtube-dl-nas")에 있음. 이건 **상단 사회적 증거**로 끌어올려야 함. 166★ 오디언스를 그대로 데려올 수 있는 가장 강한 카드.
- **5개국어 UI**(English/한국어/日本語/中文/हिन्दी) — `i18n.tsx`에 실제 구현돼 있는데 README 스캔으로는 안 보임(테스트 "locale key consistency" 한 줄 뿐). **awesome 등급에서 다국어는 강한 셀링포인트.** 상단 배지/문구로.
- "기존 NAS 폴더를 **재다운로드 없이** 스캔·인덱싱", "**DB가 날아가도 디스크에서 라이브러리 복구**", "**archive.txt 네이티브**", "**다운로드는 기본 OFF·패스당 5개 제한**" — 전부 NAS 운영자가 *"오 이건 다르네"* 할 포인트인데 산문 속에 흩어져 있음 → §6처럼 **3~5개 임팩트 불릿**으로.

### 🟠 P1-4. 실제 UI 폴리싱 결함 (HN/awesome 큐레이터가 바로 잡아냄)
직접 구동해서 발견한 것들:
- **Insights 페이지 반쪽 레이아웃 버그** — 와이드(1440px)에서 Volume Map/Storage trend/채널 압력 카드가 **왼쪽 ~45%에만** 쌓이고 **오른쪽 절반이 통째로 비어 있음**. 가장 눈에 띄는 미완성 인상. (Dashboard/Channels/Queue는 풀폭을 잘 쓰는데 Insights만 단일 컬럼) → **반응형 2~3컬럼 그리드로.**
- **버튼/타일 텍스트 잘림** — Channels 워크벤치의 "Register **already regis...**" 타일이 잘림(스샷·라이브 모두 재현). 한두 곳 더 있을 수 있음 → 말줄임 대신 줄바꿈/축약 카피.
- **Settings 페이지 와이드 여백** — 런타임 카드 한 줄 뒤로 큰 빈 공간. 와이드에서 허전.
- **커밋된 스크린샷에 로컬 절대경로 노출** — `docs/assets/screenshots/library-shelf.png`의 "Folder inspect command"에 `/Users/hyeonsang/git/channel-vault-nas/...`가 **그대로 찍혀 공개 자산에 포함**. (사소하지만 디테일에 약하다는 인상 + 약한 정보노출) → 데모 픽스처 경로로 재캡처.
- 추가로 `library-shelf.png`는 **실제로는 Channels 화면의 채널상세 Library 탭**을 보여줌(헤더가 "Channels"). 파일명/캡션과 화면 불일치 → 글로벌 Library 화면으로 재캡처 권장.

### 🟠 P1-5. 메타포가 도메인과 충돌(인지 부하)
- 화면 곳곳에 우주/콕핏 메타포가 섞여 있음: "NAS **observatory**", "operating **cockpit**", "**Ignite** a channel into the vault", "Archive **launch** control", "Dry-run the download **wave**", 컴포넌트명 `ChannelConstellation`, `QueueFlow`, `data/observatory.ts`, `mock_observatory.py`.
- 멋부린 톤은 매력 있지만, **처음 온 사람에겐 "이게 NAS 아카이브 툴이라고?"** 하는 거리감 + 번역체. NAS 운영자(실용 지향)에게 특히. → **도메인 직설 언어로 통일** 권장: observatory→console/dashboard, ignite→register/add, launch control→download queue 등. (브랜드 톤은 hero 카피 한 곳에서만 살짝.)

### 🟡 P1-6. 빈 첫 실행(첫 클론) 화면이 "데모"를 안 앞세움
- clone 264회 = 실제로 띄워보는 사람 많음. 그런데 빈 상태 Dashboard는 **0이 잔뜩 찍힌 카드 30여 개 + "Know what needs attention before opening a drawer"**(추상적) + Clean install gate/Mount Doctor/Mission control이 한꺼번에 쏟아짐.
- 정작 "**Load safe demo**"(=값이 채워진 살아있는 제품을 보는 유일한 버튼)는 화면 **60% 아래 "First Source" 섹션**에 작게 묻혀 있음.
- 데모 GIF의 **첫 프레임도 "0·checking" 빈 상태** → 첫인상이 "텅 빈 대시보드".
- **액션:** 빈 워크스페이스일 때 **헤드라인을 환영/온보딩으로 교체**("Welcome — load the demo to see Channel Vault in 10 seconds") + **거대한 단일 "Load demo workspace" 히어로 CTA**. GIF도 데모 시드 상태(값 채워진 화면)부터 시작하도록 재녹화.

### 🟡 P2-7. 프론트엔드 모놀리스(직접 star 요인은 아니지만 "awesome 신뢰"·기여 유입에 영향)
- `frontend/src/App.tsx` = **13,412줄 단일 파일**, `styles.css` = **13,021줄**. 컴포넌트 디렉터리엔 단 3개(`MetricTile`/`QueueFlow`/`ChannelConstellation`)뿐 → 6개 화면이 사실상 한 파일 안 거대 블록.
- 백엔드는 정반대로 매우 단정함(36개 서비스 모듈, 라우터/스키마/모델 분리, alembic 마이그레이션, **테스트 92개 그린**). 이 비대칭이 아쉬움.
- 잠재 기여자/리뷰어가 `App.tsx` 열면 13k줄에 압도됨 → **PR/기여 장벽**. awesome-list나 HN에서 코드 보러 온 개발자에게 마이너스.
- **액션(중기):** 화면 단위(`Dashboard/Channels/Library/Queue/Insights/Settings`)로 컴포넌트 분할, 공통 훅/그리드 추출. 당장 star엔 영향 작지만 **"진지한 프로젝트" 인상**과 컨트리뷰션을 키움.

---

## 3. 이미 훌륭한 것 (절대 깨지 말 것)

- **실제 UI 완성도가 매우 높다.** 다크 콕핏, 정보 밀도, 라이브 이벤트 pill, readiness 점수, 단계형 "First run runway", 디스크-인지 커버리지 — 동급 self-hosted 툴 중 상위권 비주얼. *이게 최대 무기인데 안 보여주는 게 죄.*
- **백엔드가 견고**: 36 서비스, 92 테스트 그린, alembic, 스키마/모델 분리, redacted support bundle, mount doctor.
- **안전 기본값(Guarded by default)**: 다운로드 OFF·패스당 5개·확인 모달 — 신뢰 형성에 좋음.
- **원클릭 안전 데모**(YouTube 호출/다운로드 없이 결정론적 시드) — 온보딩 자산으로 최고. 더 앞세우면 됨.
- **5개국어 i18n**, CI/Pages/Release 워크플로, 이슈/PR 템플릿, SECURITY/CONTRIBUTING/CHANGELOG, Docker Hub+GHCR 이미지, 60초 설치 경로 — **레포 하이진 자체는 awesome 등급.**
- 풍부한 docs(아키텍처/로드맵/NAS설치/보안/백업복구/KO·EN 매뉴얼).

---

## 4. 우선순위 액션 플랜 (10분 star 만들기)

| # | 액션 | 임팩트 | 노력 | 분류 |
| --- | --- | --- | --- | --- |
| 1 | **커스텀 소셜 프리뷰 이미지** 등록(실제 콕핏 스샷+한 줄 정의) | ★★★★★ | 30분 | P0 |
| 2 | **README 상단 30초 재설계**(실제 GIF hero↑, 배지 3~4개, 차별점 3불릿, 경고는 하단 1섹션) | ★★★★★ | 반나절 | P0 |
| 3 | **사회적 증거 상단화**: "youtube-dl-nas(166★) 제작자" + "5개국어 UI" 배지/문구 | ★★★★☆ | 30분 | P0 |
| 4 | **Insights 반쪽 레이아웃 버그** 수정(2~3컬럼) | ★★★★☆ | 1~2시간 | P1 |
| 5 | 버튼/타일 **텍스트 잘림** 수정("Register already regis…") | ★★★☆☆ | 30분 | P1 |
| 6 | 빈 첫 실행 **"Load demo" 단일 히어로 CTA** + 환영 카피 | ★★★★☆ | 2~3시간 | P1 |
| 7 | **메타포 정리**(observatory/ignite/launch → 도메인 직설어) | ★★★☆☆ | 반나절 | P1 |
| 8 | 커밋 스크린샷 **로컬 경로 노출 제거** + library 스샷 재캡처 | ★★☆☆☆ | 30분 | P1 |
| 9 | **README를 절반으로**: 운영 백과사전(스모크/배포/플래그 등)은 docs로, README는 "쇼케이스"화 | ★★★★☆ | 반나절 | P1 |
| 10 | **한국어 진입점**(`README.ko.md` 또는 상단 KO 3줄 요약) — Clien/svrforum 트래픽 대응 | ★★★☆☆ | 2시간 | P1 |
| 11 | GitHub **Discussions ON** + **good first issue 2~3개** + README에 "⭐ if useful" 한 줄·로드맵 링크 | ★★★☆☆ | 1시간 | P2 |
| 12 | **데모 GIF 재녹화**(값 채워진 화면부터 시작, 0 나열 회피) | ★★★☆☆ | 1~2시간 | P2 |
| 13 | `App.tsx`/`styles.css` **모놀리스 분할**(화면별 컴포넌트) | ★★☆☆☆(직접) / 기여·신뢰엔 ★★★★ | 수일 | P2 |

> 권장 순서: **1 → 3 → 5 → 8 → 4**(반나절 안에 끝나는 고ROI 묶음) → 그다음 **2 → 9 → 6**(README/온보딩 재구성) → 이후 7·10·11·12 → 13.

---

## 5. "Awesome 등급" 10초 체크리스트 (방문자가 무의식적으로 던지는 질문)

- [ ] **0–3초: 소셜 카드/스샷 한 장**으로 "오 예쁘다/뭔지 알겠다"가 되는가? → *현재 ✗ (회색 OG)*
- [ ] **3–10초: 한 줄 + 3불릿**으로 "나(NAS 운영자/크리에이터)에게 왜 필요한지" 잡히는가? → *현재 △ (산문에 분산)*
- [ ] **10–20초: 실제 제품이 멋져 보이는가**(목업 아닌 진짜 UI)? → *현재 △ (SVG가 가림)*
- [ ] **신뢰: 유지보수·진지함 신호**(CI·release·tests·docker pulls)가 과하지 않게 보이는가? → *현재 ○ (있음, 배지 과다)*
- [ ] **신뢰: 사회적 증거**(누가 만들었나/이미 누가 쓰나)? → *현재 ✗ (166★ 전작 언급이 맨 끝)*
- [ ] **마찰: "지금 바로 60초 안에 본다"**가 한눈에? → *현재 ○ (있으나 경고에 묻힘)*
- [ ] **감정: "안 누르면 손해" 같은 한 방**(다국어/디스크 복구/재다운로드 없이 인덱싱)? → *현재 △*

10초 안에 위 7개 중 5개 이상이 ✓면 star가 붙는다. 지금은 신뢰 축은 강한데 **첫인상·차별점·사회적 증거 축이 약하다.**

---

## 6. 바로 쓸 수 있는 카피 초안 (README 상단)

> **Channel Vault NAS**
> *Back up and manage every video from your own YouTube channels — on your own NAS.*
>
> *(실제 Dashboard 콕핏 GIF 한 장)*
>
> 🛰️ From the maker of **[youtube-dl-nas](https://github.com/hyeonsangjeon/youtube-dl-nas) (166★)** · 🌐 **5 languages** · 🐳 Docker in 60s · 🔒 Guarded downloads by default
>
> **Why it's different**
> - 📂 **Index your existing NAS folders without re-downloading** — it reads media, sidecars, subtitles, thumbnails, and rebuilds the index from disk.
> - 🧾 **`archive.txt`-native** — your classic ledger becomes a real operator workflow (already-archived vs missing).
> - 🛟 **Survives a lost database** — the filesystem is the source of truth; SQLite is just the index.
> - 🚦 **Safe by default** — downloads are OFF until you opt in, capped at 5 per pass, every job visible & auditable.
> - ▶️ **See it in 10 seconds** — one click loads a safe demo (no YouTube calls, no downloads).
>
> ```bash
> git clone https://github.com/hyeonsangjeon/channel-vault-nas.git && cd channel-vault-nas
> cp .env.example .env && mkdir -p metadata downfolder runtime
> docker compose up -d   # open http://127.0.0.1:5173 → "Load demo"
> ```
>
> <sub>로컬·LAN·VPN·신뢰 리버스프록시 전용 가드 알파입니다. 보안 경계는 [SECURITY.md] 참고.</sub>  ← *경고는 이렇게 한 줄로 압축해 아래로.*

---

## 7. 검증 메모 (이 피드백이 추측이 아님)

- 로컬에서 **백엔드+프론트 실제 기동** → `POST /api/ops/demo-workspace`로 데모 시드 → 6개 화면 + 빈 첫 실행 화면을 **직접 캡처**해 판단.
- **Insights 반쪽 레이아웃**, **"Register already regis…" 잘림**, **Settings 여백**, **빈 상태의 0 나열/데모 CTA 매몰**은 라이브에서 재현 확인.
- **백엔드 테스트 92개 전부 통과**(`pytest`), alembic 마이그레이션 정상 → 코드 견고함 근거.
- `gh repo view`로 **`usesCustomOpenGraphImage:false`**, 토픽 14개(양호), 설명 양호, prerelease `v0.1.0-alpha.1` 존재, open issues 0, Discussions off 확인.
- 커밋된 `library-shelf.png`의 **로컬 절대경로 노출**과 **파일명/화면 불일치**는 자산 픽셀에서 직접 확인.

---

### 마무리
재료는 충분하다. **"숨겨둔 좋은 것들(예쁜 UI·다국어·디스크 복구·166★ 전작)을 첫 10초로 끌어올리고, 경고를 뒤로 미루고, 소셜 카드 한 장을 다는 것"** — 이 세 가지만 해도 같은 트래픽에서 star 전환이 눈에 띄게 올라갈 것이다.
