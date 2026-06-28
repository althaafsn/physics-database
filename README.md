# Physics Problem Database

Browse Indonesian physics olympiad problems (OSK / OSP / OSN), build custom exam sets in the browser, and export PDFs via print.

**Live demo:** https://d28e99c7v2289t.cloudfront.net

## Features

- Searchable library of ~439 curated problems with LaTeX math and diagram assets
- Set builder with drag-and-drop ordering, saved sets (localStorage), and starter templates
- Print-ready preview → Save as PDF (no server-side PDF generation)
- Static Next.js export — deploys to S3 + CloudFront for ~$0.50–$2/mo
- Python ingestion pipeline for PDF → structured JSON corpus

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/physics-database.git
cd physics-database
npm ci
npm run build:static    # export catalog → public/data, build out/
npm run preview:static  # open http://localhost:3000
```

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, Tailwind CSS, KaTeX |
| Data | Static JSON + SVG assets (no backend API) |
| Deploy | S3 + CloudFront (Terraform) |
| Pipeline | Python — PDF ingest, LLM repair/translate, catalog export |

## Deploy to AWS

```bash
chmod +x deploy/aws/deploy.sh
./deploy/aws/deploy.sh
```

See [deploy/aws/README.md](deploy/aws/README.md) for IAM setup and teardown.

## What ships in the build

| Data | Source |
|------|--------|
| Problem library (~439) | `parsed/catalog/problems.jsonl` → `public/data/catalog.*.json` |
| Diagram assets | `parsed/assets/` → `public/assets/` |
| Starter set | `data/starter-sets.json` |

Source PDFs (`all_pdf/`) are **not** in this repo — only the parsed corpus is committed.

## Saved sets

- Stored in **browser localStorage** (this device only, no login)
- First visit seeds **OSK Mechanics Sample** from `data/starter-sets.json`
- Auto-saved when you edit a set

## PDF export

Preview → **Print / Save PDF** → choose “Save as PDF” in the print dialog.

## Refresh catalog after pipeline changes

```bash
python scripts/sync_catalog.py
npm run build:static
./deploy/aws/deploy.sh
```

## Local dev

```bash
npm run export:data   # populate public/data from corpus
npm run dev           # http://localhost:3000
```

## Record a product demo

Automated walkthrough with spotlight overlays and step captions:

```bash
npx playwright install chromium   # first time only
npm run demo:record
npm run demo:enhance              # optional 4K upscale (requires ffmpeg)
```

Output goes to `demo/output/` (gitignored). See [scripts/demo/README.md](scripts/demo/README.md).

## Project layout

```
app/              Next.js UI (static export)
components/       React components
lib/              Client utilities, corpus mapping, localStorage sets
parsed/           Problem corpus (gold, catalog, assets)
scripts/          Catalog sync, static export, demo recorder
data/             Committed config (starter sets)
deploy/aws/       S3 + CloudFront deploy (Terraform)
src/              Python ingestion / LLM pipeline
tests/            Pipeline unit tests
```

## License

MIT — see [LICENSE](LICENSE).
