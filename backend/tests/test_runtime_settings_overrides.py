"""Startup overlay for operator-saved runtime settings.

These guard the fix that keeps a saved auto-download schedule applied across
restarts even when process/compose env injects a different default for the same
key, so the operator does not see a permanent "restart required" drift.
"""

from pathlib import Path

import pytest

from app.config import settings
from app.services import runtime_settings as rs


def _write_runtime_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, body: str) -> Path:
    env_file = tmp_path / ".env.runtime"
    env_file.write_text(body, encoding="utf-8")
    monkeypatch.setattr(settings, "runtime_env_file", str(env_file))
    return env_file


def test_managed_override_wins_over_process_default(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Simulate a compose ``${VAR:-1}`` default already loaded into settings.
    monkeypatch.setattr(settings, "download_worker_scheduler_limit", 1)
    _write_runtime_env(tmp_path, monkeypatch, "CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT=7\n")

    applied = rs.apply_managed_runtime_overrides()

    assert applied == ["download_worker_scheduler_limit"]
    assert settings.download_worker_scheduler_limit == 7
    # The saved value now matches the live process, so no restart drift remains.
    overrides = {row.key: row for row in rs._pending_overrides()}
    assert overrides["CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT"].pending_restart is False


def test_managed_override_coerces_bool_int_and_str(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "download_worker_scheduler_enabled", False)
    monkeypatch.setattr(settings, "metadata_sync_scheduler_interval_seconds", 900)
    monkeypatch.setattr(settings, "ytdlp_binary", "yt-dlp")
    _write_runtime_env(
        tmp_path,
        monkeypatch,
        "CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED=true\n"
        "CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS=45\n"
        "CVN_YTDLP_BINARY=/opt/yt-dlp\n",
    )

    rs.apply_managed_runtime_overrides()

    assert settings.download_worker_scheduler_enabled is True
    assert settings.metadata_sync_scheduler_interval_seconds == 45
    assert settings.ytdlp_binary == "/opt/yt-dlp"


def test_managed_override_is_noop_when_unchanged(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "download_worker_scheduler_limit", 7)
    _write_runtime_env(tmp_path, monkeypatch, "CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT=7\n")

    assert rs.apply_managed_runtime_overrides() == []
    assert settings.download_worker_scheduler_limit == 7


def test_managed_override_is_noop_without_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "download_worker_scheduler_limit", 3)
    monkeypatch.setattr(settings, "runtime_env_file", str(tmp_path / "missing.env.runtime"))

    assert rs.apply_managed_runtime_overrides() == []
    assert settings.download_worker_scheduler_limit == 3
