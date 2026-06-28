from __future__ import annotations

import shutil
import subprocess
import sys
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

from src.ingest_registry import IngestRegistryStore, IngestStage
from src.paths import PipelinePaths


@dataclass
class BronzeConvertResult:
    slug: str
    pdf_path: Path
    ok: bool
    detail: str = ""


def bronze_md_path(paths: PipelinePaths, slug: str) -> Path:
    return paths.bronze_folder(slug) / f"{slug}.md"


def is_bronze_ready(paths: PipelinePaths, slug: str) -> bool:
    return bronze_md_path(paths, slug).is_file()


def list_pending_marker_pdfs(
    paths: PipelinePaths,
    *,
    registry: IngestRegistryStore | None = None,
    only_slugs: Iterable[str] | None = None,
) -> list[tuple[str, Path]]:
    """Return (slug, pdf_path) pairs that still need Marker conversion."""
    allowed = set(only_slugs) if only_slugs is not None else None
    pending: list[tuple[str, Path]] = []

    for pdf in sorted(paths.pdf_dir.glob("*.pdf")):
        slug = pdf.stem
        if allowed is not None and slug not in allowed:
            continue
        if is_bronze_ready(paths, slug):
            continue
        pending.append((slug, pdf))

    if registry is not None:
        # Keep registry order hints stable for status output.
        stage_rank = {
            IngestStage.PDF_ONLY: 0,
            IngestStage.BRONZE_READY: 1,
            IngestStage.SILVER_DONE: 2,
            IngestStage.GOLD_DONE: 3,
        }
        pending.sort(
            key=lambda item: (
                stage_rank.get(registry.get(item[0]).stage if registry.get(item[0]) else IngestStage.PDF_ONLY, 0),
                item[0],
            )
        )

    return pending


def resolve_marker_single() -> list[str]:
    """Return argv prefix to invoke marker_single."""
    marker_single = shutil.which("marker_single")
    if marker_single:
        return [marker_single]
    return [sys.executable, "-m", "marker.scripts.convert_single"]


def convert_pdf_to_bronze(
    pdf_path: Path,
    *,
    bronze_dir: Path,
    marker_argv: list[str] | None = None,
    timeout_s: float | None = None,
) -> BronzeConvertResult:
    slug = pdf_path.stem
    bronze_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        *(marker_argv or resolve_marker_single()),
        str(pdf_path.resolve()),
        "--output_dir",
        str(bronze_dir.resolve()),
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        return BronzeConvertResult(
            slug=slug,
            pdf_path=pdf_path,
            ok=False,
            detail=f"timeout after {exc.timeout}s",
        )

    md_path = bronze_dir / slug / f"{slug}.md"
    if proc.returncode == 0 and md_path.is_file():
        return BronzeConvertResult(slug=slug, pdf_path=pdf_path, ok=True)

    err = (proc.stderr or proc.stdout or "").strip()
    if len(err) > 400:
        err = err[:400] + "..."
    detail = err or f"exit code {proc.returncode}"
    return BronzeConvertResult(slug=slug, pdf_path=pdf_path, ok=False, detail=detail)


def convert_pending_pdfs(
    paths: PipelinePaths,
    items: list[tuple[str, Path]],
    *,
    marker_argv: list[str] | None = None,
    timeout_s: float | None = None,
    log: Callable[[str], None] | None = print,
) -> list[BronzeConvertResult]:
    results: list[BronzeConvertResult] = []
    total = len(items)
    for index, (slug, pdf_path) in enumerate(items, start=1):
        if log:
            log(f"[Marker {index}/{total}] {slug}")
        result = convert_pdf_to_bronze(
            pdf_path,
            bronze_dir=paths.bronze_dir,
            marker_argv=marker_argv,
            timeout_s=timeout_s,
        )
        results.append(result)
        if log:
            status = "ok" if result.ok else f"failed: {result.detail}"
            log(f"  → {status}")
    return results
