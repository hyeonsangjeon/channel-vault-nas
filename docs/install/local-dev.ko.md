# 로컬 개발

FastAPI 백엔드와 Vite 개발 서버를 직접 실행합니다 — 코드를 수정하기에 가장
좋습니다.

## 사전 준비

- Python 3.11+
- Node.js 20+ (CI는 Node.js 24로 검증)
- `yt-dlp`
- `ffmpeg` / `ffprobe`

## 백엔드

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
CVN_DB_MIGRATE_ON_STARTUP=true uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## 프런트엔드

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173
```

## 콘솔 열기

```text
http://127.0.0.1:5173/
```

## 헬스 체크

```bash
curl http://127.0.0.1:8000/api/health
```

!!! tip "실제 다운로드 켜기"
    개발 서버는 워커가 **꺼진** 상태로 시작합니다. 실제 전송을 하려면 워커
    플래그를 설정하고 백엔드를 재시작하세요 —
    [실제 다운로드 켜기](../usage/enable-downloads.md) 참고.

## 다음 단계

- [첫 백업 마법사](../usage/first-backup.md)를 따라가 보세요.
- 로컬에서 설정할 수 있는 [런타임 플래그](../reference/runtime-flags.md)를
  살펴보세요.
- 앱을 실제 아카이브로 가리키기 전에
  [파일시스템 규칙](../reference/filesystem.md)을 이해하세요.
