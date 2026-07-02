#!/usr/bin/env python3
"""Scrape Dimensi Sains YouTube channel and link videos to corpus problems."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.paths import PipelinePaths
from src.record_store import load_jsonl
from src.youtube.match import FULL_PEMBAHASAN_RE, build_problem_links, match_videos_to_problems
from src.youtube.scrape import CHANNEL_URL, enrich_video_descriptions, fetch_channel_videos
from src.youtube.timestamps import load_manual_descriptions, parse_description_timestamps


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Dimensi Sains YouTube links")
    parser.add_argument(
        "--channel-url",
        default=CHANNEL_URL,
        help="YouTube channel videos tab URL",
    )
    parser.add_argument(
        "--fuzzy-min-score",
        type=float,
        default=0.52,
        help="Minimum title similarity for fuzzy matches",
    )
    parser.add_argument(
        "--skip-fetch-descriptions",
        action="store_true",
        help="Do not call yt-dlp for descriptions (use cached/manual only)",
    )
    args = parser.parse_args()

    paths = PipelinePaths.resolve(ROOT)
    catalog_path = paths.catalog_problems_path
    if not catalog_path.is_file():
        print(f"Missing {catalog_path}. Run scripts/sync_catalog.py first.", file=sys.stderr)
        return 1

    problems = load_jsonl(catalog_path, lenient=True)
    videos = fetch_channel_videos(args.channel_url)
    manual_descriptions = load_manual_descriptions(ROOT)

    exam_video_ids = {
        v.video_id
        for v in videos
        if FULL_PEMBAHASAN_RE.search(v.title)
    }
    if not args.skip_fetch_descriptions and exam_video_ids:
        videos = enrich_video_descriptions(
            videos,
            exam_video_ids,
            manual_descriptions=manual_descriptions,
        )
    elif manual_descriptions:
        videos = enrich_video_descriptions(
            videos,
            set(manual_descriptions),
            manual_descriptions=manual_descriptions,
        )

    out_dir = paths.parsed_dir / "youtube"
    out_dir.mkdir(parents=True, exist_ok=True)

    videos_path = out_dir / "dimensi_sains_videos.jsonl"
    with videos_path.open("w", encoding="utf-8") as f:
        for video in videos:
            row = video.to_dict()
            if row.get("description"):
                row["has_timestamps"] = bool(parse_description_timestamps(row["description"]))
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    links, unmatched = match_videos_to_problems(
        videos,
        problems,
        fuzzy_min_score=args.fuzzy_min_score,
    )
    by_problem = build_problem_links(links)
    timestamped = sum(1 for link in links if link.start_seconds is not None)

    links_path = out_dir / "problem_links.jsonl"
    with links_path.open("w", encoding="utf-8") as f:
        for link in links:
            f.write(json.dumps(link.to_dict(), ensure_ascii=False) + "\n")

    index_path = out_dir / "links_by_problem.json"
    index_path.write_text(
        json.dumps(by_problem, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    review_path = out_dir / "unmatched_videos.jsonl"
    with review_path.open("w", encoding="utf-8") as f:
        for row in unmatched:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    manifest = {
        "channel": "dimensisains",
        "channel_url": args.channel_url,
        "synced_at": datetime.now(UTC).isoformat(),
        "video_count": len(videos),
        "link_count": len(links),
        "timestamped_links": timestamped,
        "problems_with_video": len(by_problem),
        "unmatched_count": len(unmatched),
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
