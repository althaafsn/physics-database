# AGENTS.md

## Cursor Cloud specific instructions

This repo has two services:

- **Reader (core product)** — a Next.js (static export) app for browsing physics problems and building exam sets. No backend or account needed.
- **Editor (optional)** — a FastAPI backend (`admin/server`) powering the `/admin/*` editor UI. Secondary feature.

The update script already runs `npm ci` and provisions the Python venv at `admin/server/.venv`, so dependencies are installed on startup.

### Reader app

- Run dev: `npm run dev` (serves http://localhost:3000). The `predev` hook auto-runs `npm run export:data`, which regenerates `public/data/*.json` from `parsed/catalog/problems.jsonl` — do not hand-edit the generated `public/data` files.
- Build (matches CI): `npm run build:static` → static site in `out/`. CI (`.github/workflows/ci.yml`) only runs this build.
- `npm run lint` is currently broken: the `lint` script calls `eslint`, which is **not** a declared dependency, so it exits with `eslint: not found`. Lint is not part of CI.
- Static export quirk: `next.config.mjs` sets `output: 'export'` and `typescript.ignoreBuildErrors: true`, so type errors will not fail the build.

### Editor backend (`admin/server`)

- Run both API + reader together: `npm run dev:admin` (API on :8000, reader on :3000). `admin/dev.sh` lazily creates the venv only if it is missing, so after a dependency change re-run `pip install -r admin/server/requirements.txt -r requirements-web.txt` into `admin/server/.venv` manually.
- **Important gotcha:** in dev, if neither `JWT_SECRET` nor `_PHYSICS_ADMIN_DEV_JWT` is set, the API generates a *new random* JWT secret on every call (see `effective_jwt_secret()` in `admin/server/physics_admin/config.py`), so every issued token is immediately rejected as "Invalid token". To exercise authenticated editor flows, export a stable secret before starting, e.g. `export JWT_SECRET="dev-local-stable-secret-please-change-0123456789"`.
- Editor flow: register at `/admin/signup`, mock-subscribe at `/admin/subscribe` (no Stripe locally), edit at `/admin/problems`. The public deploy ships with the editor UI disabled (`NEXT_PUBLIC_ENABLE_ADMIN=false`).
- Tests: `admin/server/.venv/bin/python -m pytest admin/server/tests` (run with `PHYSICS_DB_ROOT` and `PYTHONPATH` pointing at the repo / `admin/server`). `pytest` is installed by the update script but is not in `requirements.txt`.

### Corpus data pipeline (Python)

- Corpus tiers live in `parsed/`: `gold/problems.jsonl` (source of truth) → `silver/problems.jsonl` → `parsed/catalog/problems.jsonl` (published, eligible subset). `npm run export:data` then maps the catalog into `public/data/*.json` (gitignored) for the reader.
- `parsed/catalog/problems.jsonl` is *not* always a clean `sync_catalog(gold)` output (it has downstream edits), so corpus maintenance scripts edit the tier files in place rather than regenerating the catalog from gold.
- Subparts are derived from the inline `(a) … (b) …` block in `body_md` via `SUBPART_RE`/`extract_subparts` (`src/split_problems.py`); the reader renders both `body` and the `parts` list. `scripts/dedupe_subparts.py` strips the duplicated inline block from `body_md` (idempotent; run `npm run export:data` afterwards). Run repo tests with `PYTHONPATH=. <venv>/bin/python -m pytest tests/`.
