"""Verify downloader dependencies, media transfer, and disk recovery in temporary storage."""

import argparse
import asyncio
import hashlib
import json
import os
import re
import signal
import subprocess
import tempfile
from contextlib import contextmanager, suppress
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version
from pathlib import Path
from threading import Thread


def run(arguments: list[str], timeout: int = 120) -> str:
    with subprocess.Popen(
        arguments, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True,
    ) as process:
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired as error:
            with suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            raise RuntimeError(f"{arguments[0]} exceeded the {timeout}-second limit") from error
        if process.returncode:
            raise RuntimeError(f"{arguments[0]} failed: {stderr[-1600:]}")
        return stdout


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, message: str, *arguments: object) -> None:
        pass


@contextmanager
def generated_source(root: Path):
    source_dir = root / "source"
    source_dir.mkdir()
    run([
        "ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=10",
        "-t", "1", "-c:v", "mpeg4", str(source_dir / "fixture.mp4"),
    ])
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(source_dir)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/fixture.mp4"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def download(source_url: str, video_id: str, *, live: bool) -> None:
    from app.config import settings
    from app.models.archive import Channel, DownloadJob, Video
    from app.services.download_worker import _worker_command

    _, command = _worker_command(
        job=DownloadJob(quality="b[height<=360]/worst"),
        video=Video(external_id=video_id, title="Download verification", published_at=None, upload_date=None),
        channel=Channel(handle="@cvn-verification", external_id="UC_CVN_VERIFY", title="Download verification"),
    )
    command[-1] = source_url
    command.extend([
        "--ignore-config", "--no-playlist", "--no-cache-dir", "--socket-timeout", "15",
        "--retries", "1", "--extractor-retries", "1", "--fragment-retries", "1",
        "--max-filesize", "50M",
    ])
    if live:
        command.extend(["--match-filter", "duration <= 30 & !is_live"])
    run(command, timeout=180)
    if not list(Path(settings.download_dir).rglob("video.info.json")):
        raise RuntimeError("No sidecar was written; a skipped or unavailable video is not a successful download")


async def verify_indexes(root: Path) -> dict[str, object]:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.database import AsyncSessionLocal, Base, engine, init_db
    from app.models.archive import Channel, MediaFile
    from app.services.archive_metrics import build_channel_coverage_from_db
    from app.services.archive_rescan import apply_rescan_plan
    from app.services.storage_guard import backup_sqlite_database

    archive = root / "archive"
    rebuilt_engine = create_async_engine(f"sqlite+aiosqlite:///{root / 'rebuilt.db'}")
    snapshots: list[dict[str, str]] = []
    try:
        await init_db()
        async with rebuilt_engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        for session_factory in (AsyncSessionLocal, async_sessionmaker(rebuilt_engine, expire_on_commit=False)):
            async with session_factory() as database:
                result = await apply_rescan_plan(database, archive)
                await database.commit()
                media = list((await database.scalars(select(MediaFile))).all())
                channels = list((await database.scalars(select(Channel))).all())
                if result.media_files_indexed != 1 or len(media) != 1 or len(channels) != 1:
                    raise RuntimeError(f"Expected one recovered video: {result.model_dump()}")
                if not media[0].video_codec or not media[0].width or not media[0].size_bytes:
                    raise RuntimeError("Real ffprobe metadata is missing from the media index")
                coverage = await build_channel_coverage_from_db(database, channels[0].id, download_dir=archive)
                if coverage is None or coverage.archived != 1 or coverage.missing != 0:
                    raise RuntimeError("Downloaded media was not reflected in disk-aware coverage")
                snapshots.append(file_hashes(archive))
        if snapshots[0] != snapshots[1]:
            raise RuntimeError("Index recovery changed archive files")
        backup = backup_sqlite_database(f"sqlite+aiosqlite:///{root / 'original.db'}", root / "metadata")
        if backup is None or not backup.is_file():
            raise RuntimeError("SQLite snapshot verification failed")
        return {"indexed_media": 1, "rebuilt_media": 1, "files_unchanged": True, "sqlite_snapshot": "verified"}
    finally:
        await rebuilt_engine.dispose()
        await engine.dispose()


def file_hashes(root: Path) -> dict[str, str]:
    hashes = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            with path.open("rb") as handle:
                hashes[path.relative_to(root).as_posix()] = hashlib.file_digest(handle, "sha256").hexdigest()
    return hashes


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--youtube-video-id", help="An authorized, non-live video at most 30 seconds long")
    parser.add_argument("--allow-network", action="store_true", help="Explicitly allow the optional YouTube test")
    arguments = parser.parse_args()
    if arguments.youtube_video_id and (
        not arguments.allow_network or not re.fullmatch(r"[A-Za-z0-9_-]{11}", arguments.youtube_video_id)
    ):
        parser.error("A valid YouTube video ID and --allow-network are both required")
    with tempfile.TemporaryDirectory(prefix="cvn-download-verification-") as temporary:
        root = Path(temporary)
        os.environ.update(
            CVN_DATABASE_URL=f"sqlite+aiosqlite:///{root / 'original.db'}",
            CVN_DOWNLOAD_DIR=str(root / "archive"),
            CVN_METADATA_DIR=str(root / "metadata"),
            CVN_RUNTIME_ENV_FILE=str(root / "runtime.env"),
            CVN_DOWNLOAD_WORKER_ENABLED="false",
            CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED="false",
            CVN_METADATA_SYNC_SCHEDULER_ENABLED="false",
        )
        run(["deno", "eval", "console.log('JavaScript runtime ready')"])
        dependencies = {name: version(name) for name in ("yt-dlp", "yt-dlp-ejs")}
        if arguments.youtube_video_id:
            download(
                f"https://www.youtube.com/watch?v={arguments.youtube_video_id}",
                arguments.youtube_video_id,
                live=True,
            )
        else:
            with generated_source(root) as source_url:
                download(source_url, "fixture", live=False)
        report = asyncio.run(verify_indexes(root))
        report.update(
            source="youtube" if arguments.youtube_video_id else "generated_local_fixture",
            youtube_verified=bool(arguments.youtube_video_id),
            dependencies=dependencies,
        )
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
