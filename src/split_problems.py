from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

PROBLEM_TITLE_RE = re.compile(r"^\d+\.\s")
PROBLEM_HEADING_MD_RE = re.compile(
    r"^#{1,6}\s+\*{0,2}(\d+\.\s+.+?)\*{0,2}\s*$",
    re.MULTILINE,
)
INLINE_NUMBERED_RE = re.compile(
    r"(?:^|\n)(?:-\s*)?(\d+)\)\s",
    re.MULTILINE,
)
SECTION_TITLE_RE = re.compile(
    r"^#{2,6}\s+\*{0,2}(?!\d+\.\s)(.+?)\*{0,2}\s*$",
    re.MULTILINE,
)
VARIANT_MARKER_RE = re.compile(
    r"^#{1,6}\s+\*{0,2}(?:Versi|Version)\s+(\d+)\*{0,2}\s*$",
    re.MULTILINE | re.IGNORECASE,
)
SUBPART_RE = re.compile(
    r"(?:^|\n)(?:-\s*)?\(([a-z])\)\s*([\s\S]*?)(?=(?:\n(?:-\s*)?\([a-z]\)\s)|\n#{1,6}\s|\Z)",
    re.IGNORECASE,
)

DEFAULT_CHUNK_SIZE = 8
LONG_FORMAT_MIN_YEAR = 2021


@dataclass
class RawProblem:
    problem_number: int
    title: str
    body_md: str
    page_start: int | None
    variant: int | None = None


def _parse_problem_title(title: str) -> tuple[int, str]:
    match = re.match(r"^(\d+)\.\s+(.*)$", title.strip())
    if not match:
        raise ValueError(f"Invalid problem title: {title!r}")
    return int(match.group(1)), match.group(2).strip()


def load_toc_problems(meta_path: Path) -> list[dict]:
    with meta_path.open(encoding="utf-8") as f:
        meta = json.load(f)
    toc = meta.get("table_of_contents", [])
    return [entry for entry in toc if PROBLEM_TITLE_RE.match(entry.get("title", ""))]


def split_markdown(md_text: str) -> list[tuple[int, str, str]]:
    """Return list of (number, title, body_md) from numbered markdown headings."""
    matches = list(PROBLEM_HEADING_MD_RE.finditer(md_text))
    problems: list[tuple[int, str, str]] = []
    for i, match in enumerate(matches):
        full_title = match.group(1).strip()
        number, title = _parse_problem_title(full_title)
        body_start = match.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(md_text)
        body = md_text[body_start:body_end].strip()
        problems.append((number, title, body))
    return problems


def _infer_title_from_body(number: int, body: str) -> str:
    first_line = body.strip().split("\n", 1)[0].strip()
    first_line = re.sub(r"^[-*]\s*", "", first_line)
    first_line = re.sub(r"\*{1,2}", "", first_line).strip()
    if len(first_line) > 100:
        first_line = first_line[:97].rstrip() + "..."
    return first_line or f"Soal {number}"


def split_markdown_inline_numbered(md_text: str) -> list[tuple[int, str, str]]:
    """Split OSK 2021+ style inline numbering: ``1) ...``, ``2) ...``."""
    matches = list(INLINE_NUMBERED_RE.finditer(md_text))
    if not matches:
        return []

    problems: list[tuple[int, str, str]] = []
    for i, match in enumerate(matches):
        number = int(match.group(1))
        body_start = match.start(1)
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(md_text)
        body = md_text[body_start:body_end].strip()
        title = _infer_title_from_body(number, body)
        problems.append((number, title, body))
    return problems


def split_markdown_section_titled(md_text: str) -> list[tuple[int, str, str]]:
    """Split OSK 2020 style ``## **Title**`` sections (one problem per section)."""
    matches = list(SECTION_TITLE_RE.finditer(md_text))
    if not matches:
        return []

    problems: list[tuple[int, str, str]] = []
    for i, match in enumerate(matches):
        title = match.group(1).strip()
        title = re.sub(r"\*{1,2}", "", title).strip()
        body_start = match.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(md_text)
        body = md_text[body_start:body_end].strip()
        if not body:
            continue
        problems.append((i + 1, title, body))
    return problems


def chunk_problem_segments(
    segments: list[tuple[int, str, str]],
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> list[list[tuple[int, str, str]]]:
    """Group consecutive problem segments into batches of up to chunk_size."""
    if not segments:
        return []
    chunks: list[list[tuple[int, str, str]]] = []
    for start in range(0, len(segments), chunk_size):
        chunks.append(segments[start : start + chunk_size])
    return chunks


def split_markdown_in_chunks(
    md_text: str,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> list[tuple[int, str, str]]:
    """Parse inline-numbered docs in 7-8 problem chunks, then merge results."""
    segments = split_markdown_inline_numbered(md_text)
    if not segments:
        return []

    if len(segments) <= chunk_size:
        return segments

    merged: list[tuple[int, str, str]] = []
    for chunk in chunk_problem_segments(segments, chunk_size=chunk_size):
        start = chunk[0][0]
        end = chunk[-1][0]
        chunk_start = md_text.find(f"{start})")
        if chunk_start < 0:
            chunk_start = md_text.find(f"- {start})")
        next_num = end + 1
        next_match = INLINE_NUMBERED_RE.search(md_text, chunk_start + 1)
        while next_match and int(next_match.group(1)) <= end:
            next_match = INLINE_NUMBERED_RE.search(md_text, next_match.end())
        chunk_end = next_match.start() if next_match else len(md_text)
        chunk_md = md_text[chunk_start:chunk_end]
        merged.extend(split_markdown_inline_numbered(chunk_md))
    return merged


def _load_variant_markers(md_text: str) -> list[tuple[int, int]]:
    return [(match.start(), int(match.group(1))) for match in VARIANT_MARKER_RE.finditer(md_text)]


def _variant_at_position(markers: list[tuple[int, int]], pos: int) -> int | None:
    active: int | None = None
    for marker_pos, variant in markers:
        if marker_pos <= pos:
            active = variant
        else:
            break
    return active


def assign_section_variants(
    md_text: str,
    problems: list[tuple[int, str, str]],
) -> list[tuple[int, str, str, int | None]]:
    """Assign variant ids when problem numbers reset (e.g. OSK 2012 triple sections)."""
    if not problems:
        return []

    markers = _load_variant_markers(md_text)
    heading_matches = list(PROBLEM_HEADING_MD_RE.finditer(md_text))

    numbers = [num for num, _, _ in problems]
    has_duplicates = len(numbers) != len(set(numbers))
    if not has_duplicates and not markers:
        return [(num, title, body, None) for num, title, body in problems]

    result: list[tuple[int, str, str, int | None]] = []
    last_num = 0
    fallback_section = 1
    for idx, (num, title, body) in enumerate(problems):
        pos = heading_matches[idx].start() if idx < len(heading_matches) else 0
        variant = _variant_at_position(markers, pos)
        if variant is None and has_duplicates and num <= last_num:
            fallback_section += 1
            variant = fallback_section
        elif variant is None and markers:
            variant = markers[0][1] if markers else None
        result.append((num, title, body, variant))
        last_num = num
    return result


def detect_split_strategy(md_text: str, *, year: int | None = None) -> str:
    if PROBLEM_HEADING_MD_RE.search(md_text):
        return "heading"
    if INLINE_NUMBERED_RE.search(md_text):
        return "inline_numbered"
    if SECTION_TITLE_RE.search(md_text):
        return "section_titled"
    if year is not None and year >= LONG_FORMAT_MIN_YEAR:
        return "inline_numbered"
    return "heading"


def split_markdown_auto(
    md_text: str,
    *,
    year: int | None = None,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> list[tuple[int, str, str]]:
    strategy = detect_split_strategy(md_text, year=year)
    if strategy == "heading":
        return split_markdown(md_text)
    if strategy == "inline_numbered":
        if year is not None and year >= LONG_FORMAT_MIN_YEAR:
            return split_markdown_in_chunks(md_text, chunk_size=chunk_size)
        return split_markdown_inline_numbered(md_text)
    return split_markdown_section_titled(md_text)


def extract_subparts(body_md: str) -> list[dict[str, str]]:
    subparts: list[dict[str, str]] = []
    for match in SUBPART_RE.finditer(body_md):
        label = match.group(1).lower()
        text = match.group(2).strip()
        if text:
            subparts.append({"label": label, "text": text})
    return subparts


def split_problems_from_folder(
    output_folder: Path,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> list[RawProblem]:
    folder_name = output_folder.name
    md_path = output_folder / f"{folder_name}.md"
    meta_path = output_folder / f"{folder_name}_meta.json"

    if not md_path.is_file():
        raise FileNotFoundError(f"Missing markdown: {md_path}")
    if not meta_path.is_file():
        raise FileNotFoundError(f"Missing metadata: {meta_path}")

    md_text = md_path.read_text(encoding="utf-8")
    toc_problems = load_toc_problems(meta_path)

    year: int | None = None
    year_match = re.search(r"(20\d{2})", folder_name)
    if year_match:
        year = int(year_match.group(1))

    md_problems = split_markdown_auto(md_text, year=year, chunk_size=chunk_size)

    toc_pages: dict[int, int | None] = {}
    for entry in toc_problems:
        num, _ = _parse_problem_title(entry["title"])
        toc_pages[num] = entry.get("page_id")

    if not md_problems:
        return []

    strategy = detect_split_strategy(md_text, year=year)
    if strategy == "heading":
        annotated = assign_section_variants(md_text, md_problems)
    else:
        annotated = [(num, title, body, None) for num, title, body in md_problems]

    results: list[RawProblem] = []
    for num, title, body, variant in annotated:
        results.append(
            RawProblem(
                problem_number=num,
                title=title,
                body_md=body,
                page_start=toc_pages.get(num),
                variant=variant,
            )
        )
    return results
