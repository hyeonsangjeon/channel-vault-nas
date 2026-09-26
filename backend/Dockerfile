FROM denoland/deno:bin-2.9.7@sha256:bc5aa4466e21b6d3021226a85ba2e1911f7c386254d97b9d797903ab74edace2 AS deno

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY --from=deno /deno /usr/local/bin/deno

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY scripts/verify_download_recovery.py ./scripts/verify_download_recovery.py

RUN pip install --upgrade pip \
    && pip install . \
    && deno eval 'console.log("JavaScript runtime ready")' \
    && python -c 'from importlib.metadata import version; print("yt-dlp-ejs", version("yt-dlp-ejs"))'

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
