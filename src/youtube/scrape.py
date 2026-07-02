from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path


CHANNEL_URL = "https://www.youtube.com/@dimensisains/videos"
CHANNEL_HANDLE = "dimensisains"


@dataclass(frozen=True)
class ChannelVideo:
    video_id: str
    title: str
    url: str
    upload_date: str | None = None
    duration: int | None = None
    description: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _resolve_yt_dlp() -> str:
    for candidate in (
        shutil.which("yt-dlp"),
        str(Path(".venv/bin/yt-dlp")),
        str(Path(__file__).resolve().parents[2] / ".venv/bin/yt-dlp"),
    ):
        if candidate and Path(candidate).is_file():
            return candidate
    raise FileNotFoundError(
        "yt-dlp not found. Install with: pip install yt-dlp (or use project .venv)"
    )


def fetch_channel_videos(
    channel_url: str = CHANNEL_URL,
    *,
    yt_dlp: str | None = None,
) -> list[ChannelVideo]:
    """List public videos from a YouTube channel via yt-dlp."""
    binary = yt_dlp or _resolve_yt_dlp()
    cmd = [
        binary,
        "--flat-playlist",
        "--dump-single-json",
        channel_url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"yt-dlp failed ({proc.returncode})")

    payload = json.loads(proc.stdout)
    entries = payload.get("entries") if isinstance(payload, dict) else None
    if entries is None:
        entries = [payload] if isinstance(payload, dict) else []

    videos: list[ChannelVideo] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        video_id = entry.get("id")
        title = entry.get("title")
        if not video_id or not title:
            continue
        videos.append(
            ChannelVideo(
                video_id=video_id,
                title=title,
                url=f"https://www.youtube.com/watch?v={video_id}",
                upload_date=entry.get("upload_date"),
                duration=entry.get("duration"),
                description=entry.get("description"),
            )
        )
    return videos
