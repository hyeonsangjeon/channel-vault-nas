"""Tests for ffprobe metadata normalization."""

from app.services.media_probe import parse_ffprobe_payload


def test_parse_ffprobe_payload_normalizes_primary_streams() -> None:
    probe = parse_ffprobe_payload(
        {
            "format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2", "duration": "61.44"},
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "h264",
                    "avg_frame_rate": "30000/1001",
                    "width": 1920,
                    "height": 1080,
                },
                {"codec_type": "audio", "codec_name": "aac"},
            ],
        }
    )

    assert probe.container == "mp4"
    assert probe.video_codec == "h264"
    assert probe.audio_codec == "aac"
    assert probe.fps == 29.97
    assert probe.width == 1920
    assert probe.height == 1080
    assert probe.duration_seconds == 61


def test_parse_ffprobe_payload_falls_back_to_video_duration() -> None:
    probe = parse_ffprobe_payload(
        {
            "format": {"format_name": "matroska,webm"},
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "vp9",
                    "duration": "4.6",
                    "r_frame_rate": "24/1",
                    "width": "1280",
                    "height": "720",
                }
            ],
        }
    )

    assert probe.container == "webm"
    assert probe.video_codec == "vp9"
    assert probe.audio_codec is None
    assert probe.fps == 24
    assert probe.duration_seconds == 5
