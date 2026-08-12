# `channel-vault-nas`를 실행 가능한 NAS 복구 증거 중심 제품으로 끌어올리는 MIT 벤치마크

> GitHub 모니터의 오늘의 벤치마킹 추천을 실행 가능한 에이전트 작업 지시서로 내보낸 문서입니다.

## 문서 정보

- **추천일:** 2026-08-12
- **생성 시각:** 2026-08-12T11:59:29Z
- **분석 모델:** gpt-5.6-sol (azure_openai_v1)
- **벤치마크 대상:** [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)
- **라이선스:** MIT
- **현재 신호:** Stars 44,754 · Forks 8,915 · TypeScript

## 5문장 서론 보고

1. **지금 문제:** 현재 `channel-vault-nas`는 집이나 사무실의 저장장치인 NAS에 영상을 백업하고 복구하는 가치가 있지만, 처음 온 사람이 그 가치를 빠르게 확인하는 길은 제공된 자료만으로 검증되지 않았습니다.
2. **꼭 해야 할 분석:** 먼저 문서, 설치, 화면, 테스트, 배포 흐름을 한 단계씩 따라가며 설명한 약속과 실제 동작이 맞는지 확인해야 합니다.
3. **핵심:** 핵심은 설명을 늘리는 대신 한 번의 실행과 컴퓨터의 반복 검사로 기존 파일 재사용과 복구가 실제로 된다는 증거를 보여주는 것입니다.
4. **쉬운 성과:** 가장 쉬운 단기 개선은 첫 화면에 짧은 가치 설명, 검증된 시작 명령, 고유 기능을 보여주는 자체 화면을 같은 순서로 놓는 것입니다.
5. **근본 성과:** 장기적으로는 문서의 약속과 제품 동작을 같은 자동 검증에 묶어 업데이트 뒤에도 믿고 설치할 수 있는 저장소를 만드는 것이 목표입니다.

## 에이전트 실행 계약

- 이 문서를 작업 계획이 아니라 구현 지시서로 취급합니다.
- 기본 실행 모드는 **하루 Bolt**입니다. 원래 일차 표시는 의존 순서를 뜻하며, 병렬 가능한 조사·문서·테스트 작업은 같은 날 함께 처리합니다.
- 외부 레포는 먼저 현재 커밋 SHA와 라이선스를 확인하고, 코드나 문구를 복제하기보다 검증된 패턴을 대상 레포 구조에 맞게 독자 구현합니다.
- 각 Bolt가 끝날 때 변경 파일, 실행한 검증, 남은 위험을 기록합니다. 불확실한 기능이나 성과 수치는 사실처럼 추가하지 않습니다.
- 기존 사용자 변경을 보존하고, 대상 레포의 로컬 규칙과 테스트 방식을 우선합니다.

## 오늘의 판단

`fastapi/full-stack-fastapi-template`의 전체 기능을 옮기는 것이 아니라, 첫 방문자가 가치를 이해하고 실행하며 결과를 신뢰하게 만드는 README 정보 구조, 환경별 Compose 분리, OpenAPI 기반 클라이언트 계약, 행동 중심 E2E, 최소 권한 CI 패턴만 MIT 고지와 함께 적응합니다. 그 위에 기존 파일 재사용과 디스크 인덱스 복구를 자동으로 증명하는 고유한 Recovery Proof 흐름을 더해 일반적인 풀스택 템플릿과 분명히 다른 제품으로 만듭니다.

## 후보 선정 이유

2026-08-12 기준 제공 후보 중 가장 높은 `hot_score` 807.15를 기록했고 같은 날짜에 갱신됐으며, 44,754 stars와 8,915 forks라는 강한 관심 신호를 보입니다. 무엇보다 `channel-vault-nas`와 FastAPI·React·TypeScript·Vite·Docker Compose가 직접 겹치고, 문서·Compose·테스트·배포·릴리스 워크플로 증거가 충분해 추상적인 참고가 아니라 검증 가능한 적응 계획을 만들 수 있습니다.

- `license_spdx`가 `MIT`이고 루트 `LICENSE`와 README의 `License` 절이 함께 확인되어 MIT 기반 벤치마킹 조건을 충족합니다.
- 제공된 전체 후보 중 `hot_score`가 807.15로 가장 높고 `pushed_at`이 2026-08-12이므로 현재성과 관심도를 함께 갖췄습니다.
- `channel-vault-nas`와의 `fit_score`가 111.99로 제시됐으며 Docker, Docker Compose, FastAPI, React, TypeScript가 직접 겹칩니다.
- `README.md`, `compose.yml`, `compose.override.yml`, `compose.deploy.yml`, 개발·배포 문서와 다수의 GitHub Actions 스냅샷이 제공되어 파일 단위 근거를 확보할 수 있습니다.
- 최근 30일 제외 목록에 없고 직전 선택인 `ChatGPTNextWeb/NextChat`도 아니므로 회전 정책을 위반하지 않습니다.

### 추가 판단 근거

- SPDX, 루트 `LICENSE`, README의 라이선스 절이 모두 MIT를 가리켜 라이선스 적합성이 명확합니다.
- 제공 후보 중 가장 높은 `hot_score` 807.15와 당일 갱신 기록이 있어 현재성 있는 벤치마크입니다.
- `channel-vault-nas`와 FastAPI·React·TypeScript·Vite·Docker Compose가 직접 겹쳐 적용 가능성이 가장 높습니다.
- README 화면 흐름, 개발·배포 문서, Compose 분리, 생성 클라이언트, Playwright, 릴리스와 권한 관리까지 관찰 가능한 증거가 넓습니다.
- 범용 아이템 관리 기능을 복제하지 않고 NAS 재사용·복구 증거로 바꿀 수 있어 차별화 방향이 분명합니다.

## 내 레포 적용 대상

### 1. [hyeonsangjeon/channel-vault-nas](https://github.com/hyeonsangjeon/channel-vault-nas)

- **적용 영역:** 저장소 첫 화면의 제품 설명, NAS용 Compose 실행 구조, FastAPI와 React 사이의 API 계약, 누락분 다운로드·재사용·인덱스 복구 E2E 검증
- **매칭 근거:** FastAPI·React·TypeScript·Vite·Docker Compose가 직접 겹치는 최우선 대상이며, 10 stars, 최근 7일 47 views, 최근 14일 60 clones가 제공됐습니다. 기존 미디어와 `archive.txt`를 재사용하고 누락분만 내려받으며 디스크에서 인덱스를 복구한다는 고유 가치도 검증 가능한 사용자 여정으로 바꾸기 좋습니다.
- **첫 작업:** 코드를 바꾸기 전에 실제 파일 트리와 현재 설치 명령을 수집하고, 깨끗한 데이터 디렉터리·기존 미디어가 있는 디렉터리·인덱스가 없는 디렉터리에서 현재 동작을 각각 기록해 벤치마크 기준선을 만듭니다.
- **현재 신호:** Stars 10 · Views 7d 47 · Clones 14d 60

### 2. [hyeonsangjeon/gdpval-realworks](https://github.com/hyeonsangjeon/gdpval-realworks)

- **적용 영역:** 대시보드 정보 계층, 대표 실험의 최소 재현 경로, 산출물 검증과 채점 결과의 시각적 증거, 변경 경로별 CI
- **매칭 근거:** Python, dashboard, GitHub Actions가 겹치며 22 stars, 최근 7일 184 views, 최근 14일 246 clones가 제공됐습니다. 재현 실험, 산출물 검증, 채점, 라이브 증거 대시보드라는 흐름을 README와 CI 증거로 연결하기에 적합합니다.
- **첫 작업:** 대표 작업 하나를 골라 입력부터 검증·채점·대시보드까지의 실제 클릭과 명령 순서를 재현하고, 현재 문서에서 사용자가 막히는 지점을 기록합니다.
- **현재 신호:** Stars 22 · Views 7d 184 · Clones 14d 246

### 3. [hyeonsangjeon/youtube-dl-nas](https://github.com/hyeonsangjeon/youtube-dl-nas)

- **적용 영역:** 자체 호스팅 설치 경로, 인증·큐·배치·재개 동작의 E2E 테스트, Docker 배포 문서와 실패 복구 설명
- **매칭 근거:** Docker와 Python이 겹치고 189 stars, 최근 7일 574 views, 최근 14일 164 clones로 개인 저장소 중 강한 관심 신호가 있습니다. 인증, 비동기 WebSocket 큐, 배치, 재개라는 설명이 있어 운영 문서와 행동 테스트를 구체화할 수 있습니다.
- **첫 작업:** 임시 데이터 디렉터리에서 현재 Compose 시작 절차를 재현하고 로그인, 작업 등록, 중단, 재개를 한 번씩 수행해 문서와 실제 동작이 일치하는지 확인합니다.
- **현재 신호:** Stars 189 · Views 7d 574 · Clones 14d 164

### 4. [microsoft/azure-ai-search-foundry-iq-live-knowledge-sources](https://github.com/microsoft/azure-ai-search-foundry-iq-live-knowledge-sources)

- **적용 영역:** accelerator 첫 실행 경로, 백엔드·배포·개발 문서의 역할 분리, 최소 권한 CI와 재사용 가능한 검증 절차
- **매칭 근거:** Python 기반의 재사용 가능한 accelerator라는 점에서 백엔드 문서 분리와 배포·CI 패턴을 적용할 수 있으며, 최근 7일 185 views와 최근 14일 1,525 clones가 제공됐습니다. 이 저장소는 관리 조직 범위이므로 개선 대상에는 포함하되 해당 수치는 개인 포트폴리오 합계에 넣지 않습니다.
- **첫 작업:** 현재 accelerator의 필수 설정과 성공 경로를 한 장의 실행 지도에 정리한 뒤, React·PostgreSQL 같은 참조 저장소의 선택 사항을 가정하지 않고 문서 구조와 CI 안전장치만 선별합니다.
- **현재 신호:** Stars 15 · Views 7d 185 · Clones 14d 1,525

## 오늘의 적용 가이드

## 1. 선정 근거와 벤치마크 경계

`fastapi/full-stack-fastapi-template`는 제공된 스냅샷에서 MIT 라이선스, 44,754 stars, 8,915 forks, 2026-08-12 갱신, `hot_score` 807.15가 확인됩니다. 인기도가 각 설계의 효과를 증명하는 것은 아니지만, 활발히 사용되는 풀스택 저장소의 공개 표면과 운영 패턴을 연구하기에는 충분한 근거입니다.

벤치마크 단위는 저장소 전체가 아니라 관찰 가능한 패턴입니다.

- **연구할 표면:** 루트 `README.md`, `backend`, `frontend`, `compose.yml`, `compose.override.yml`, `compose.deploy.yml`, `development.md`, `deployment.md`, `deployment-docker-compose.md`, `release-notes.md`와 제공된 `.github/workflows/*`입니다.
- **내부 사전 조사:** 각 대상에서 `find . -maxdepth 2 -type f | sort`로 실제 트리를 먼저 확인하고, workflow 디렉터리가 있을 때만 그 안의 파일을 추가로 조사합니다.
- **근거 장부:** 관찰한 소스 경로, 확인된 사실, 내부 적용 여부, 변형 이유, 코드·문구 사용 시 필요한 MIT 고지를 한 행씩 기록합니다.
- **적응 원칙:** 정보 구조와 안전장치는 도메인에 맞게 다시 설계하고, 실제 코드가 필요한 경우에만 최소 범위를 선택해 원 라이선스 고지를 보존합니다.

수용 기준은 모든 결정이 `검증된 소스 사실`, `내부 저장소에서 확인한 사실`, `아직 검증되지 않은 추론` 중 하나로 표시되는 것입니다. stars나 forks만으로 품질 또는 전환 효과를 단정한 항목이 없어야 합니다.

## 2. 먼저 연구할 제품 전면부

참조 `README.md`는 기술 스택과 기능을 먼저 설명하고, 로그인·관리자·아이템·다크 모드·API 문서 화면을 연속으로 보여준 뒤 `How to Use It`, 백엔드 개발, 프런트엔드 개발, 배포, 일반 개발, 릴리스 노트, 라이선스로 이동합니다. 핵심 패턴은 화려한 문구보다 사용자가 볼 결과와 다음 행동을 빠르게 연결한다는 점입니다.

`channel-vault-nas`의 실제 루트 문서 경로를 확인한 뒤 다음 순서로 재구성합니다.

- 첫 문장에는 기존 설명에 이미 있는 세 가지 가치인 YouTube 채널 NAS 백업, `archive.txt` 및 기존 미디어 재사용, 디스크 기반 인덱스 복구를 압축합니다.
- 첫 시각 자료는 자체 실행 화면으로 만들고, 일반 관리자 화면보다 백업 상태, 재사용된 항목, 누락된 항목, 복구 결과가 보이게 합니다.
- 바로 아래에 실제 검증한 최소 시작 명령과 필요한 환경값만 둡니다. 세부 개발 설정은 깊은 문서로 분리합니다.
- 기능 목록은 `처음 백업`, `두 번째 실행에서 기존 파일 재사용`, `인덱스 손실 뒤 디스크 복구`라는 사용자 여정으로 바꿉니다.
- API 문서가 실제로 노출되는 경우에만 참조 README의 `Interactive API Documentation` 패턴을 적용하고, 접근 주소를 실행 검증 후 기재합니다.
- 개발·배포·릴리스 문서는 참조의 문서 분리 방식을 연구하되, 실제 내용이 짧다면 불필요한 파일을 늘리지 말고 루트 문서의 접을 수 있는 절로 유지합니다.

수용 기준은 처음 보는 사람이 깊은 문서를 열기 전에 무엇을 백업하는지, 어떻게 시작하는지, 기존 데이터가 어떻게 보호되는지를 찾을 수 있는 것입니다. 모든 명령은 깨끗한 환경에서 다시 실행하고, 화면 자료는 내부 프로젝트에서 직접 생성하며 참조 저장소의 `img/login.png`, `img/dashboard.png`, `img/dashboard-items.png`, `img/dashboard-dark.png`, `img/docs.png`를 재사용하지 않습니다.

## 3. `channel-vault-nas`에 적용할 실행 구조

참조 저장소에는 기본 `compose.yml`, 개발용으로 보이는 `compose.override.yml`, 배포용 `compose.deploy.yml`이 나뉘어 있습니다. `.github/workflows/deploy-docker-compose.yml`은 기본 파일과 배포 파일을 함께 사용해 build, 사전 준비, `up -d`를 순서대로 수행하고, `.github/workflows/deploy.yml`은 프런트엔드를 빌드하면서 `VITE_API_URL`을 빈 값으로 두어 API와 같은 출처를 사용하도록 구성합니다.

이 구조를 NAS 제품에 맞게 선별 적용합니다.

- 먼저 현재 Compose 서비스, 볼륨, 포트, 환경값을 표로 만들고 로컬 개발과 NAS 배포에서 실제로 달라지는 항목만 구분합니다.
- 공통 서비스는 기본 정의에 남기고, 소스 마운트나 개발 서버처럼 개발 전용인 설정과 영구 볼륨·재시작 정책처럼 배포 전용인 설정만 분리합니다. 실제 차이가 없다면 참조와 같은 파일 수를 맞추기 위해 억지로 분할하지 않습니다.
- FastAPI와 React가 한 도메인에서 서비스될 수 있는지는 현재 라우팅을 확인한 뒤 결정합니다. 가능하면 프런트엔드의 환경별 API 주소 부담을 줄이되, 기존 역방향 프록시 또는 모바일 접근을 깨뜨리지 않는지 확인합니다.
- 시작 전 준비 단계가 필요하다면 기존 미디어를 수정하지 않고 상태만 검사하거나 안전한 인덱스 초기화를 수행하도록 멱등성을 보장합니다. 참조의 데이터베이스 준비 명령을 그대로 가져오지 않습니다.
- 실제 파일명이 확인된 뒤 `docker compose config`, `docker compose build`, `docker compose up -d`를 순서대로 실행해 병합 결과와 시작 결과를 저장합니다. 운영 데이터에서 볼륨 삭제 명령을 사용하지 않습니다.

수용 기준은 빈 임시 데이터 디렉터리에서 시작할 수 있고, 기존 미디어와 `archive.txt`가 있는 디렉터리를 다시 연결해도 불필요한 중복 처리가 없으며, 인덱스를 제거한 별도 fixture에서는 디스크 복구가 성공하는 것입니다. 재시작 전후의 미디어 수와 복구 결과가 같아야 하며 실패 시 원인과 다음 행동이 로그 또는 UI에 나타나야 합니다.

## 4. API 계약과 행동 중심 테스트

참조 README는 자동 생성 프런트엔드 클라이언트와 대화형 API 문서를 명시합니다. `.github/workflows/playwright.yml`은 Python과 Bun 의존성을 준비하고 `bash scripts/generate-client.sh`를 실행한 뒤 Docker Compose를 빌드하며, `backend/**`, `frontend/**`, `.env`, `compose*.yml` 등 관련 경로가 바뀔 때만 E2E를 실행하고 네 개 shard로 나눕니다.

`channel-vault-nas`에서는 FastAPI의 실제 API 스키마를 React 클라이언트 계약의 기준으로 삼을 수 있는지 먼저 확인합니다.

- 현재 수동 타입이나 API 호출 래퍼가 있다면 서버 스키마와 중복되는 부분을 식별합니다.
- 생성 클라이언트를 도입할 경우 기존 패키지 관리자와 잠금 파일을 유지하고, 참조의 `uv`, Bun 또는 생성 스크립트를 그대로 전제하지 않습니다.
- 백엔드 계약이 바뀐 PR에서는 클라이언트를 다시 생성한 뒤 남는 diff가 있으면 실패하도록 검증합니다.
- E2E는 일반 CRUD 예제가 아니라 제품 고유 동작을 대상으로 합니다. 임시 fixture에서 첫 백업 동작, 기존 미디어와 `archive.txt` 재사용, 누락분만 처리하는 두 번째 실행, 인덱스 부재 후 디스크 복구를 검증합니다.
- 외부 YouTube 상태에 의존하는 테스트는 핵심 CI에서 분리하고, 재현 가능한 로컬 fixture로 중복 방지와 복구 판단을 검사합니다.
- 처음부터 네 개 shard를 복제하지 말고 단일 실행 시간을 측정한 뒤 병렬화가 실제로 필요한 경우에만 늘립니다.

수용 기준은 서버 계약 변경을 반영하지 않은 프런트엔드가 CI에서 검출되고, 주요 복구 시나리오가 같은 fixture로 반복 통과하며, 실패한 단계와 artifact를 확인할 수 있는 것입니다. 생성 후 `git diff --exit-code`가 깨끗해야 하고, UI에 표시한 재사용·누락·복구 수가 검증 보고서와 일치해야 합니다.

## 5. CI·배포 안전장치의 선택적 이식

제공된 참조 workflow들은 `permissions: {}` 또는 `contents: read`에서 시작해 job별로 필요한 권한만 추가하고, 여러 checkout에서 `persist-credentials: false`를 사용하며, job마다 `timeout-minutes`를 둡니다. 외부 Action을 커밋 SHA로 고정하고, `.github/workflows/playwright.yml`은 경로 필터를 사용하며, 배포 workflow는 `concurrency`와 수동 실행 조건을 둡니다.

내부 workflow에는 다음 순서로 적용합니다.

- workflow별 이벤트, 읽는 비밀값, 쓰는 리소스, 필요한 권한을 표로 만든 뒤 기본 권한을 읽기 전용 또는 빈 값으로 낮춥니다.
- checkout 자격 증명이 이후 단계에 필요하지 않다면 유지하지 않고, 배포 job에만 필요한 쓰기 권한과 환경 비밀을 둡니다.
- lint, 단위 테스트, E2E, 이미지 build, 배포에 각각 현실적인 timeout을 지정합니다.
- 프런트엔드만 바뀐 경우 백엔드의 비싼 작업을 생략하는 등 경로 필터를 사용하되, 공통 환경·Compose·계약 파일 변경은 누락하지 않습니다.
- Action SHA 고정은 업데이트 책임과 함께 도입합니다. 참조의 현재 SHA를 그대로 복사하지 말고 도입 시점의 검토된 버전을 기록합니다.
- 참조의 `pull_request_target` workflow는 메타데이터만 읽는다는 주석과 제한을 포함합니다. 내부에서 같은 이벤트가 꼭 필요하지 않다면 사용하지 말고, 필요할 때도 외부 PR 코드를 checkout하거나 실행하지 않는 별도 보안 검토를 거칩니다.
- `.github/workflows/smokeshow.yml`의 90% coverage 기준은 참조 정책일 뿐이므로 복제하지 않습니다. 내부 위험 구간과 현재 기준선을 보고 단계적으로 정합니다.

수용 기준은 fork PR 또는 비밀값이 없는 PR에서도 테스트가 안전하게 종료되고, 로그에 비밀값이나 전체 런타임 문맥을 불필요하게 출력하지 않으며, NAS 배포가 일반 PR에서 자동 실행되지 않는 것입니다. self-hosted runner를 쓸 경우 저장소 코드가 실행되는 경계와 배포 권한을 별도로 승인해야 합니다.

## 6. 보조 내부 저장소에 적용하는 범위

주요 구현은 직접 스택이 겹치는 `channel-vault-nas`에 집중하고, 나머지 대상에는 검증된 패턴만 좁게 전파합니다.

- **`gdpval-realworks`:** README 첫 화면에 대표 작업 하나의 입력, 산출물 검증, 채점, 대시보드 결과를 연속으로 보여줍니다. 참조의 화면 중심 정보 구조와 경로 필터형 CI를 적용하되 풀스택 인증이나 PostgreSQL 구성은 전제하지 않습니다. 최근 7일 184 views와 최근 14일 246 clones는 우선순위를 정하는 별도 신호이며 전환율로 계산하지 않습니다.
- **`youtube-dl-nas`:** 참조의 Docker Compose 배포 문서 분리와 Playwright식 행동 검증을 인증, 큐 등록, 배치, 중단 후 재개에 맞게 적응합니다. 189 stars와 최근 7일 574 views는 이미 발견성이 있다는 신호이므로 기능 추가보다 설치 실패와 운영 불확실성을 줄이는 데 초점을 둡니다.
- **`microsoft/azure-ai-search-foundry-iq-live-knowledge-sources`:** 백엔드 개발·배포·일반 개발 문서의 역할 분리와 최소 권한 CI만 적용합니다. React, JWT, 이메일 복구, PostgreSQL은 확인 없이 도입하지 않습니다. 최근 7일 185 views와 최근 14일 1,525 clones는 해당 관리 조직 저장소의 운영 신호로만 다루고 개인 stars·traffic 합계에서는 제외합니다.

각 보조 저장소의 수용 기준은 대표 성공 경로 하나가 깨끗한 환경에서 문서대로 재현되고, 그 경로를 보호하는 최소 한 개의 자동 검증이 존재하는 것입니다. 공통 템플릿 모양을 맞추는 것이 아니라 각 저장소의 고유 산출물이 화면과 CI에 나타나야 합니다.

## 7. 발견성과 스타 전환을 위한 검증

참조 README에서 관찰되는 전환 장치는 명확한 기술·기능 요약, 실제 화면, 바로 실행하는 행동, 분리된 심화 문서, 테스트 상태입니다. 이것들이 44,754 stars의 원인이라고 단정할 수는 없지만, 처음 방문한 사용자의 불확실성을 줄이는지 내부에서 검증할 수는 있습니다.

`channel-vault-nas`의 시작 기준선은 10 stars, 최근 7일 47 views, 최근 14일 60 clones입니다. 기간이 다르므로 서로 나눠 전환율을 만들지 않습니다.

- 저장소 설명, README 첫 문장, 정확한 topics가 모두 NAS 채널 백업·기존 파일 재사용·인덱스 복구라는 같은 검색 언어를 사용하도록 정렬합니다.
- 첫 화면에는 자체 스크린샷 또는 짧은 시연, 검증된 시작 명령, 지원 NAS 환경을 확인하는 문서 링크를 둡니다.
- badge는 실제로 통과하는 CI, 라이선스, 배포 가능한 릴리스처럼 사용자가 판단에 활용할 수 있는 것만 남깁니다.
- 기능 증거 뒤에는 사용해 보기, 문제 보고, 유용할 때 star로 저장하기 같은 명확한 다음 행동을 한 번만 배치합니다.
- 개선 배포일을 기록하고 T+14와 T+28에 같은 정의의 stars, 7일 views, 14일 clones를 다시 기록합니다. README·배포·기능 변경을 한꺼번에 반복하지 말고 릴리스 노트로 변경 묶음을 남깁니다.

수용 기준은 모든 링크와 명령이 검증되고, 검색 설명과 README의 약속이 실제 화면·테스트와 일치하며, 후속 보고서가 단순한 star 증가뿐 아니라 traffic 창과 변경 시점을 함께 보여주는 것입니다. 향상 여부는 관찰 결과로 판단하며 수치 상승을 약속하지 않습니다.

## 8. 차별화 확장, 비복제 원칙, 추론 경계

창의적 확장은 `Recovery Proof Mode`입니다. 일반 관리 화면을 늘리는 대신 `channel-vault-nas`가 주장하는 기존 파일 재사용과 디스크 복구를 사용자가 직접 확인하게 합니다.

- 작은 테스트용 미디어·메타데이터·`archive.txt` fixture를 준비합니다.
- 첫 실행에서 발견된 항목과 실제 처리 대상을 기록하고, 두 번째 실행에서 재사용된 항목과 누락분만 분리합니다.
- 인덱스가 없는 복제 fixture에서 디스크 스캔으로 복구한 수와 실패 이유를 기계 판독 가능한 보고서로 남깁니다.
- UI에는 재사용, 누락, 복구, 실패 네 상태만 간결하게 표시하고 보고서의 수와 연결합니다.
- 같은 fixture를 E2E에 사용해 README 화면과 CI artifact가 동일한 동작을 증명하게 합니다.

이는 참조의 관리자·아이템 화면을 흉내 내는 것이 아니라 NAS 제품의 고유 위험인 중복 다운로드와 인덱스 손실을 전면에 배치하는 적응입니다. 참조의 브랜드, 문구, 화면 자산, 예제 데이터, 전체 파일 구조는 사용하지 않습니다. JWT, 이메일 복구, Mailcatcher, PostgreSQL, Traefik, FastAPI Cloud도 내부 요구가 확인되기 전에는 도입하지 않습니다.

MIT 준수를 위해 실제 코드나 문서 표현을 가져오는 경우 원 저작권·라이선스 고지를 보존하고, 내부 문서에 `fastapi/full-stack-fastapi-template`, MIT, 연구한 경로, 2026-08-12 검토일과 실제 checkout 후 확인한 커밋을 기록합니다. 저장소 수준 MIT 표시는 개별 이미지나 모든 의존성의 권리까지 자동으로 증명하지 않으므로 자산은 자체 제작하고 의존성은 별도로 확인합니다.

마지막으로 다음은 추론으로 남겨야 합니다. 참조의 높은 stars와 forks가 특정 README 또는 CI 패턴 때문에 생겼다는 주장, 내부 traffic이 문서 문제를 뜻한다는 주장, 같은 출처 배포나 생성 클라이언트가 현재 내부 구조에 바로 맞는다는 주장은 아직 검증되지 않았습니다. 수용 기준은 Recovery Proof가 반복 가능한 fixture에서 같은 결과를 내고, UI·보고서·E2E가 일치하며, 출처 장부와 MIT 고지가 리뷰에서 확인되는 것입니다.

## 적용할 패턴

### 1. README 제품 전면부

- **참조 위치:** `README.md`의 `Technology Stack and Features`, Dashboard 화면들, `Interactive API Documentation`, `How to Use It`, 개발·배포·라이선스 순서
- **적용 대상:** hyeonsangjeon/channel-vault-nas
- **실행:** 실제 루트 문서를 확인한 뒤 첫 설명, 자체 화면, 검증된 시작 명령, 재사용·복구 여정, 심화 문서 링크 순으로 재구성합니다.
- **기대 이유:** 검색으로 들어온 방문자가 코드 탐색 전에 제품 가치와 실행 가능성을 판단하게 해 발견 이후의 이탈을 줄일 수 있습니다.

### 2. 문서 역할 분리

- **참조 위치:** `backend/README.md`, `frontend/README.md`, `development.md`, `deployment.md`, `deployment-docker-compose.md`, `release-notes.md`
- **적용 대상:** hyeonsangjeon/channel-vault-nas, microsoft/azure-ai-search-foundry-iq-live-knowledge-sources
- **실행:** 루트 문서는 결정과 빠른 시작만 담당하게 하고, 실제로 내용이 충분한 경우에만 백엔드·개발·배포·릴리스 문서를 분리합니다.
- **기대 이유:** 첫 실행 정보가 운영 세부사항에 묻히지 않으면서 유지보수자는 필요한 깊이까지 이동할 수 있습니다.

### 3. 환경별 Compose 구성

- **참조 위치:** `compose.yml`, `compose.override.yml`, `compose.deploy.yml`과 `.github/workflows/deploy-docker-compose.yml`의 결합 실행
- **적용 대상:** hyeonsangjeon/channel-vault-nas, hyeonsangjeon/youtube-dl-nas
- **실행:** 공통 서비스와 개발·NAS 배포 차이를 먼저 표로 만든 뒤 실제 차이가 있는 설정만 overlay로 분리하고 `docker compose config`로 병합 결과를 검증합니다.
- **기대 이유:** 개발 편의 설정이 NAS 운영에 섞이거나 영구 데이터 설정이 로컬 개발을 방해하는 위험을 줄입니다.

### 4. OpenAPI 계약과 같은 출처 배포

- **참조 위치:** `README.md`의 자동 생성 프런트엔드 클라이언트·API 문서 설명, `.github/workflows/playwright.yml`의 `scripts/generate-client.sh`, `.github/workflows/deploy.yml`의 빈 `VITE_API_URL`
- **적용 대상:** hyeonsangjeon/channel-vault-nas
- **실행:** 현재 FastAPI 스키마와 React API 래퍼의 중복을 확인하고, 적합할 때 생성 클라이언트의 stale diff 검사와 같은 출처 라우팅을 도입합니다.
- **기대 이유:** 백엔드와 프런트엔드가 다른 계약을 가정하는 오류를 조기에 찾고 NAS 설치자가 관리할 환경값을 줄일 수 있습니다.

### 5. 경로 인식형 E2E

- **참조 위치:** `.github/workflows/playwright.yml`의 변경 경로 필터, Python·Bun 준비, 클라이언트 생성, Compose build, 네 개 shard
- **적용 대상:** hyeonsangjeon/channel-vault-nas, hyeonsangjeon/gdpval-realworks, hyeonsangjeon/youtube-dl-nas
- **실행:** 각 제품의 대표 사용자 여정을 fixture 기반 E2E로 만들고, 관련 경로 변경에만 실행하며 단일 shard 기준선을 측정한 뒤 필요할 때만 병렬화합니다.
- **기대 이유:** 화면 존재 여부가 아니라 저장소가 약속하는 핵심 결과가 실제로 유지되는지를 검증할 수 있습니다.

### 6. GitHub Actions 최소 권한

- **참조 위치:** 제공된 workflow들의 `permissions`, `timeout-minutes`, `persist-credentials: false`, SHA 고정 Action과 배포 `concurrency`
- **적용 대상:** 선정한 네 내부 저장소
- **실행:** 이벤트·비밀값·쓰기 작업을 먼저 조사한 후 workflow 기본 권한을 낮추고 job별 최소 권한, timeout, 안전한 checkout과 배포 동시성 제어를 적용합니다.
- **기대 이유:** 공급망과 자격 증명 노출 범위를 줄이면서 실패한 자동화가 무기한 실행되는 일을 막습니다.

### 7. 릴리스와 검증 증거

- **참조 위치:** `release-notes.md`, `.github/workflows/prepare-release.yml`, `.github/workflows/create-draft-release.yml`, `.github/workflows/smokeshow.yml`
- **적용 대상:** hyeonsangjeon/channel-vault-nas, hyeonsangjeon/gdpval-realworks
- **실행:** 변경 묶음과 검증 결과를 릴리스 노트에 연결하되 참조의 버전 스크립트와 90% coverage 기준을 그대로 복제하지 않고 현재 릴리스 방식과 기준선에 맞춥니다.
- **기대 이유:** 방문자가 최근 변경과 품질 상태를 확인할 수 있고, traffic 변화도 어떤 변경 뒤에 발생했는지 해석하기 쉬워집니다.

## 하루 Bolt 체크리스트

> 아래 순서를 유지하되 하나의 집중 작업일에 완료할 수 있습니다. 서로 독립적인 조사, 문서화, 테스트 준비는 병렬로 진행합니다.

- [ ] **Bolt 1 · 1일차: 선정 참조의 제공 경로와 네 내부 저장소의 실제 트리·실행 명령을 대조하고, 검증된 사실과 추론을 분리합니다.**
  - 산출물: 소스 경로, 관찰 사실, 적용 대상, 적용 여부, 변형 이유, MIT 고지 필요 여부가 포함된 벤치마크 장부와 현재 동작 기준선
  - 완료 조건: 외부 기준 저장소가 `fastapi/full-stack-fastapi-template` 하나뿐이고, 내부에 존재한다고 확인하지 않은 파일 경로는 제안 또는 미확인으로 표시돼야 합니다.
- [ ] **Bolt 2 · 2일차: `channel-vault-nas`의 제품 전면부를 자체 화면과 검증된 시작 절차 중심으로 다시 설계합니다.**
  - 산출물: 가치 설명, 화면 자료, 빠른 시작, 기존 파일 재사용, 누락분 처리, 인덱스 복구, 심화 문서 링크를 포함한 문서 변경안
  - 완료 조건: 깨끗한 환경에서 문서 명령이 실행되고 모든 화면이 대상 저장소에서 직접 생성됐으며 참조의 문구나 이미지가 포함되지 않아야 합니다.
- [ ] **Bolt 3 · 3일차: 현재 Compose 구성을 조사해 개발과 NAS 배포의 실제 차이만 분리하고 데이터 안전 시나리오를 실행합니다.**
  - 산출물: Compose 책임표, 병합된 설정 출력, 빈 데이터·기존 데이터·인덱스 부재 fixture의 실행 기록
  - 완료 조건: `docker compose config`와 build가 성공하고, 기존 미디어가 예상 밖으로 변경되지 않으며 재시작 결과가 일관돼야 합니다.
- [ ] **Bolt 4 · 4일차: FastAPI 스키마와 React 호출 계층의 계약 중복을 분석하고 적합할 경우 생성 클라이언트 검증을 추가합니다.**
  - 산출물: API 계약 결정 기록, 재생성 명령, stale client를 탐지하는 검증 단계
  - 완료 조건: 계약 변경 후 재생성을 생략하면 검사가 실패하고, 재생성 후 `git diff --exit-code`가 깨끗해야 합니다.
- [ ] **Bolt 5 · 5일차: 첫 실행, `archive.txt` 재사용, 누락분 처리, 디스크 인덱스 복구를 fixture 기반 E2E로 만듭니다.**
  - 산출물: 외부 네트워크에 의존하지 않는 fixture, 단일 shard E2E, 실패 시 확인 가능한 로그 또는 artifact
  - 완료 조건: 동일 fixture를 반복 실행해 재사용·누락·복구 수가 같고 실패한 동작이 테스트 이름과 출력에서 식별돼야 합니다.
- [ ] **Bolt 6 · 6일차: 내부 GitHub Actions의 권한, checkout, timeout, 경로 필터, 배포 조건을 검토해 필요한 안전장치만 적용합니다.**
  - 산출물: workflow 권한표와 최소 권한 CI 변경안
  - 완료 조건: 비밀값이 없는 PR에서도 검증이 안전하게 끝나고, 일반 PR이 NAS 또는 self-hosted 환경에 배포되지 않으며 불필요한 쓰기 권한이 없어야 합니다.
- [ ] **Bolt 7 · 7일차: `Recovery Proof Mode`를 최소 기능으로 구현하고 문서·UI·자동 검증을 하나의 증거 흐름으로 연결합니다.**
  - 산출물: 재사용·누락·복구·실패 수를 담은 기계 판독 보고서, 대응 UI, 자체 화면, E2E 결과
  - 완료 조건: 보고서와 UI 수치가 일치하고 인덱스가 없는 fixture에서 복구가 재현되며, 기존 미디어를 파괴하지 않아야 합니다.
- [ ] **Bolt 8 · 후속 1~2일: 검증된 문서·Compose·CI 패턴을 `gdpval-realworks`, `youtube-dl-nas`, 관리 조직 accelerator에 필요한 범위만 전파합니다.**
  - 산출물: 각 저장소별 대표 성공 경로 하나와 이를 보호하는 최소 자동 검증
  - 완료 조건: 세 저장소가 같은 템플릿 모양을 갖는 대신 각각 검증·채점·대시보드, 인증·큐·재개, accelerator 설정·실행이라는 고유 결과를 보여줘야 합니다.

## 차별화 방향

- 기능 나열형 README를 첫 실행·재사용·복구가 이어지는 증거 중심 사용자 여정으로 전환
- 수동 API 타입과 호출 코드를 FastAPI 스키마에 연결된 계약 검증으로 정리
- 개발 편의 설정과 NAS 영구 운영 설정을 실제 차이만 기준으로 분리
- 일반 CRUD E2E 대신 `archive.txt` 재사용과 디스크 인덱스 복구를 회귀 테스트로 보호
- 모든 workflow에 최소 권한, timeout, 안전한 checkout, 경로 필터와 배포 경계를 적용
- 자체 화면·릴리스 노트·CI artifact를 연결해 README의 약속을 실행 결과로 증명
- 기간이 다른 traffic 수치를 억지로 비율화하지 않고 배포 시점과 같은 창의 추세로 평가

**창의적 확장:** `Recovery Proof Mode`를 `channel-vault-nas`의 대표 차별점으로 만듭니다. 작은 fixture를 대상으로 첫 스캔, 기존 미디어와 `archive.txt` 재사용, 누락분 판별, 인덱스 제거 후 디스크 복구를 순서대로 실행하고 재사용·누락·복구·실패 수를 하나의 기계 판독 보고서로 남깁니다. 같은 값을 UI 카드, README 자체 화면, E2E artifact에서 확인하게 해 사용자가 실제 개인 미디어를 위험에 놓지 않고 핵심 보존 동작을 검증하도록 합니다. 이는 참조의 일반 관리자·아이템 화면을 옮기는 것이 아니라 NAS 백업 제품의 고유한 신뢰 문제를 제품 기능으로 승격하는 차별화입니다.

**기대 효과:** 단기적으로는 `channel-vault-nas` 방문자가 제품의 고유 가치와 실행 경로를 더 빨리 이해하고, 설치 전에 재사용·복구 증거를 확인할 수 있게 됩니다. 중기적으로는 API 계약, Compose 검증, 도메인 E2E, 최소 권한 CI가 문서와 실제 동작의 불일치를 줄여 자체 호스팅 신뢰를 높일 수 있습니다. `gdpval-realworks`와 `youtube-dl-nas`에도 대표 결과 중심 화면과 행동 검증을 적용하면 기존 traffic이 저장소 이해와 재방문 또는 star로 이어질 가능성을 높일 수 있지만, 이는 보장된 수치가 아니라 T+14와 T+28의 동일 정의 지표로 확인해야 할 가설입니다.

## 리스크와 완화책

- **리스크:** 인기 있는 템플릿의 기능을 과도하게 이식해 NAS 백업 제품의 초점이 흐려질 수 있습니다.
  - 완화책: 모든 도입 항목을 재사용·누락분 처리·복구·배포 중 하나의 실제 사용자 문제와 연결하고 연결되지 않는 기능은 제외합니다.
- **리스크:** Compose 또는 시작 전 준비 절차가 기존 NAS 미디어나 인덱스를 손상할 수 있습니다.
  - 완화책: 임시 fixture와 복제 데이터에서 먼저 검증하고, 기본 동작을 비파괴적으로 만들며 운영 데이터에는 볼륨 삭제나 초기화 명령을 사용하지 않습니다.
- **리스크:** `pull_request_target`, 쓰기 권한 또는 self-hosted runner를 무비판적으로 도입하면 외부 PR 코드와 비밀값의 경계가 약해질 수 있습니다.
  - 완화책: 일반 검증은 읽기 전용 PR 이벤트에서 실행하고, 배포와 self-hosted 실행은 승인된 환경으로 분리하며 외부 PR 코드를 권한 있는 문맥에서 실행하지 않습니다.
- **리스크:** 참조의 네 개 Playwright shard와 90% coverage 기준을 그대로 적용하면 CI 비용과 불안정성이 늘 수 있습니다.
  - 완화책: 단일 shard와 현재 coverage 기준선을 먼저 측정하고 실행 시간과 위험 구간이 정당화할 때만 병렬화와 임계값을 높입니다.
- **리스크:** 외부 YouTube 상태에 의존하는 E2E가 간헐적으로 실패할 수 있습니다.
  - 완화책: 핵심 재사용·누락·복구 테스트는 고정 fixture로 실행하고 실제 네트워크 검증은 수동 또는 별도 비차단 작업으로 분리합니다.
- **리스크:** 높은 stars와 forks를 README·CI 패턴의 인과 효과로 오해할 수 있습니다.
  - 완화책: 인기도는 선정 신호로만 사용하고 내부 개선 효과는 배포 시점과 같은 정의의 후속 traffic·star 기록으로 별도 평가합니다.

## 라이선스와 출처

- `fastapi/full-stack-fastapi-template`는 제공된 `license_spdx: MIT`, 루트 `LICENSE`, README의 `License` 절로 MIT가 확인됩니다.
- 실제 소스 코드나 상당한 문서 표현을 사용·수정·배포할 때는 해당 부분과 함께 원 저작권 고지와 MIT 허가 고지를 보존합니다.
- 투명성을 위해 내부 문서에 저장소 이름, URL, MIT, 연구한 경로, 검토일 2026-08-12와 실제 checkout 후 확인한 커밋을 기록하는 벤치마크·귀속 절을 둡니다.
- 구조와 아이디어는 내부 도메인에 맞춰 새로 구현하고, 참조의 로고·스크린샷·브랜드·예제 데이터는 사용하지 않습니다.
- 저장소의 MIT 표시는 모든 제3자 이미지와 의존성의 권리를 자동으로 확인해 주지 않으므로 도입한 자산과 패키지의 라이선스를 별도로 점검합니다.

### 적용하지 않을 것

- 참조 저장소의 로고, 배너, `img/login.png`, `img/dashboard.png`, `img/dashboard-items.png`, `img/dashboard-dark.png`, `img/docs.png` 같은 화면 자산
- 참조 README의 문장, 기능 설명, 섹션 전체를 그대로 전재하는 방식
- `backend`와 `frontend` 전체 트리 또는 일반 아이템 관리 기능을 도메인 검토 없이 옮기는 방식
- PostgreSQL, JWT, 이메일 비밀번호 복구, Mailcatcher, Traefik, FastAPI Cloud를 요구사항 확인 없이 기본값으로 채택하는 방식
- 참조 조직의 프로젝트 URL, 토큰 이름, 배포 비밀값, 저장소 소유자 조건과 조직 전용 issue 관리 workflow
- `pull_request_target` workflow와 외부 PR 종료 정책을 내부 위협 모델과 기여 정책 검토 없이 적용하는 방식
- self-hosted runner 배포, 네 개 Playwright shard, 90% coverage 임계값을 현재 규모 측정 없이 복제하는 방식
- 참조 시점의 Action SHA와 도구 버전을 업데이트 계획 없이 그대로 고정하는 방식

## 에이전트 완료 보고 형식

1. **결론:** 오늘 구현한 핵심 변화와 판단을 5줄 이내로 요약합니다.
2. **변경 파일:** 파일별 변경 이유를 적습니다.
3. **검증:** 실행한 테스트, 빌드, 화면 검증과 결과를 적습니다.
4. **벤치마크 추적:** 참조한 외부 커밋 SHA, 파일, 독자 구현 범위를 적습니다.
5. **남은 판단:** 미완료 항목, 위험, 다음 우선순위를 적습니다.

원본 벤치마크 레포: https://github.com/fastapi/full-stack-fastapi-template
