# Local development

Run the FastAPI backend and the Vite dev server directly — best for editing the
code.

## Prerequisites

- Python 3.11+
- Node.js 20+ (CI verifies with Node.js 24)
- `yt-dlp`
- `ffmpeg` / `ffprobe`

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
CVN_DB_MIGRATE_ON_STARTUP=true uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Frontend

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173
```

## Open the console

```text
http://127.0.0.1:5173/
```

## Health check

```bash
curl http://127.0.0.1:8000/api/health
```

!!! tip "Turn on real downloads"
    The dev servers start with the worker **off**. To perform real transfers, set
    the worker flags and restart the backend — see
    [Enable real downloads](../usage/enable-downloads.md).

## Next steps

- Walk through the [First backup wizard](../usage/first-backup.md).
- Review the [Runtime flags](../reference/runtime-flags.md) you can set locally.
- Understand the [Filesystem contract](../reference/filesystem.md) before pointing
  the app at a real archive.
