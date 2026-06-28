#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.paths import PipelinePaths
from src.problem_set import (
    VALID_TOPICS,
    ProblemSetFilters,
    build_problem_set,
    corpus_stats,
    filter_problems,
    load_corpus,
)


def _parse_csv_ints(raw: str | None) -> list[int]:
    if not raw:
        return []
    return [int(part.strip()) for part in raw.split(",") if part.strip()]


def _parse_csv_strs(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def _parse_ids(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.replace("\n", ",").split(",") if part.strip()]


def cmd_stats(args: argparse.Namespace, paths: PipelinePaths) -> int:
    records = load_corpus(paths, use_gold=not args.silver)
    stats = corpus_stats(records, clean_only=args.clean_only)
    print(json.dumps(stats.__dict__, indent=2, ensure_ascii=False))
    return 0


def cmd_preview(args: argparse.Namespace, paths: PipelinePaths) -> int:
    records = load_corpus(paths, use_gold=not args.silver)
    filters = ProblemSetFilters(
        clean_only=not args.include_errors,
        levels=[level.upper() for level in args.level or []],
        years=args.year or [],
        topics=[topic.lower() for topic in args.topic or []],
        document_slugs=args.slug or [],
    )
    matched = filter_problems(records, filters)
    print(f"Matching problems: {len(matched)}")
    for rec in matched[: args.limit]:
        print(f"  - {rec.id} [{rec.level} {rec.year} {rec.topic}] {rec.title[:60]}")
    if len(matched) > args.limit:
        print(f"  ... and {len(matched) - args.limit} more")
    return 0


def cmd_build(args: argparse.Namespace, paths: PipelinePaths) -> int:
    if args.topic:
        unknown = [topic for topic in args.topic if topic.lower() not in VALID_TOPICS]
        if unknown:
            print(f"Unknown topic(s): {', '.join(unknown)}", file=sys.stderr)
            print(f"Valid topics: {', '.join(sorted(VALID_TOPICS))}", file=sys.stderr)
            return 1

    filters = ProblemSetFilters(
        clean_only=not args.include_errors,
        levels=[level.upper() for level in args.level or []],
        years=args.year or [],
        topics=[topic.lower() for topic in args.topic or []],
        document_slugs=args.slug or [],
    )

    formats = {part.strip().lower() for part in args.format.split(",") if part.strip()}
    if not formats:
        formats = {"markdown", "json"}

    write_pdf = "pdf" in formats
    write_markdown = "markdown" in formats or "md" in formats or write_pdf

    try:
        result = build_problem_set(
            paths,
            name=args.name,
            filters=filters,
            ids=_parse_ids(args.ids) or None,
            count=args.count,
            seed=args.seed,
            use_gold=not args.silver,
            title=args.title,
            output_dir=args.out_dir.resolve() if args.out_dir else None,
            write_markdown=write_markdown,
            write_json="json" in formats,
            write_pdf=write_pdf,
            locale=getattr(args, "locale", "id") or "id",
        )
    except (ValueError, FileNotFoundError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Built problem set '{result.name}' with {len(result.problems)} problem(s)")
    print(f"Output: {result.output_dir}")
    if result.manifest_path:
        print(f"  JSON: {result.manifest_path}")
    if result.markdown_path:
        print(f"  Markdown: {result.markdown_path}")
    if result.pdf_path:
        print(f"  PDF: {result.pdf_path}")
    elif write_pdf and result.pdf_error:
        print(f"  PDF: failed ({result.pdf_error})", file=sys.stderr)
    elif write_pdf:
        print("  PDF: failed (unknown error)", file=sys.stderr)
    if result.copied_assets:
        print(f"  Assets copied: {result.copied_assets}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a custom exam set from gold (or silver) problem corpus."
    )
    parser.add_argument("--root", type=Path, default=None, help="Project root")
    parser.add_argument("--parsed-dir", type=Path, default=None, help="Parsed output directory")
    parser.add_argument(
        "--silver",
        action="store_true",
        help="Use silver corpus instead of gold",
    )

    sub = parser.add_subparsers(dest="command", required=True)

    stats = sub.add_parser("stats", help="Show corpus counts")
    stats.add_argument("--clean-only", action="store_true", help="Stats for clean records only")

    preview = sub.add_parser("preview", help="List problems matching filters")
    preview.add_argument("--level", action="append", help="OSK, OSP, or OSN (repeatable)")
    preview.add_argument("--year", type=int, action="append", help="Competition year (repeatable)")
    preview.add_argument("--topic", action="append", help="Topic filter (repeatable)")
    preview.add_argument("--slug", action="append", help="Document slug filter (repeatable)")
    preview.add_argument("--include-errors", action="store_true", help="Include records with errors")
    preview.add_argument("--limit", type=int, default=20, help="Max rows to print")

    build = sub.add_parser("build", help="Build a problem set")
    build.add_argument("--name", required=True, help="Set name (used as output folder name)")
    build.add_argument("--title", help="Exam title for markdown header")
    build.add_argument("--out-dir", type=Path, help="Output directory (default: parsed/sets/<name>)")
    build.add_argument("--level", action="append", help="OSK, OSP, or OSN (repeatable)")
    build.add_argument("--year", type=int, action="append", help="Competition year (repeatable)")
    build.add_argument(
        "--years",
        type=_parse_csv_ints,
        help="Comma-separated years, e.g. 2019,2020,2021",
    )
    build.add_argument("--topic", action="append", help="Topic filter (repeatable)")
    build.add_argument(
        "--topics",
        type=_parse_csv_strs,
        help="Comma-separated topics, e.g. mechanics,electromagnetism",
    )
    build.add_argument("--slug", action="append", help="Document slug filter (repeatable)")
    build.add_argument("--ids", help="Comma/newline-separated problem ids (explicit selection)")
    build.add_argument("--count", type=int, help="Random sample size from filtered pool")
    build.add_argument("--seed", type=int, help="Random seed for --count")
    build.add_argument(
        "--include-errors",
        action="store_true",
        help="Include records with validation errors (default: clean only)",
    )
    build.add_argument(
        "--format",
        default="markdown,json",
        help="Output formats: markdown, json, pdf (comma-separated)",
    )
    build.add_argument(
        "--locale",
        choices=("id", "en"),
        default="id",
        help="Problem text language (same ids; English when translated)",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    paths = PipelinePaths.resolve(args.root)
    if args.parsed_dir:
        paths = PipelinePaths(
            root=paths.root,
            pdf_dir=paths.pdf_dir,
            bronze_dir=paths.bronze_dir,
            parsed_dir=args.parsed_dir.resolve(),
        )

    if args.command == "build":
        if getattr(args, "years", None):
            args.year = (args.year or []) + args.years
        if getattr(args, "topics", None):
            args.topic = (args.topic or []) + args.topics

    if args.command == "stats":
        return cmd_stats(args, paths)
    if args.command == "preview":
        return cmd_preview(args, paths)
    if args.command == "build":
        return cmd_build(args, paths)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
