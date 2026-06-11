"""yt-dlp progress parser tests."""

from app.services.ytdlp_progress import parse_size_label, parse_ytdlp_progress_line


def test_parse_ytdlp_download_progress_line() -> None:
    parsed = parse_ytdlp_progress_line("[download]  42.3% of 123.45MiB at 1.25MiB/s ETA 00:42")

    assert parsed is not None
    assert parsed.status == "downloading"
    assert parsed.percent == 42.3
    assert parsed.total_bytes == int(123.45 * 1024**2)
    assert parsed.speed == "1.25MiB/s"
    assert parsed.eta == "00:42"


def test_parse_ytdlp_destination_and_finished_lines() -> None:
    destination = parse_ytdlp_progress_line("[download] Destination: /archive/video.mp4")
    finished = parse_ytdlp_progress_line("[download] 100% of 7.00MiB in 00:00:02 at 3.20MiB/s")

    assert destination is not None
    assert destination.status == "destination"
    assert destination.path == "/archive/video.mp4"
    assert finished is not None
    assert finished.status == "finished"
    assert finished.percent == 100.0
    assert finished.total_bytes == 7 * 1024**2


def test_parse_size_label_handles_binary_units_and_unknowns() -> None:
    assert parse_size_label("512B") == 512
    assert parse_size_label("1.50GiB") == int(1.5 * 1024**3)
    assert parse_size_label("Unknown B") is None
    assert parse_ytdlp_progress_line("not a progress line") is None
