# Automated product demo

Records a guided walkthrough of the static site with spotlight overlays, zoom, and step captions.

## Requirements

```bash
npm install
npx playwright install chromium
```

Optional: `ffmpeg` for MP4 export.

## Record (desktop — full tour)

```bash
npm run demo:record
```

Outputs:

- `demo/output/physics-db-demo.webm` (1920×1080)
- `demo/output/physics-db-demo.mp4` (if ffmpeg is installed)

## Record (set builder focus)

```bash
DEMO_BASE_URL=https://labfisika.com npm run demo:record:sets
```

Outputs: `demo/output/physics-db-demo-sets.webm` (+ `.mp4`)

## Record (AI tutor focus)

Requires a live AI endpoint (use production URL):

```bash
DEMO_BASE_URL=https://labfisika.com npm run demo:record:ai-tutor
```

Outputs: `demo/output/physics-db-demo-ai-tutor.webm` (+ `.mp4`)

## Verify features (smoke test)

```bash
DEMO_BASE_URL=https://labfisika.com npm run demo:verify
```

Checks API health, tutor chat, navigation, library, set builder, and AI tutor UI.

## Record (mobile)

```bash
npm run demo:record:mobile
```

Outputs:

- `demo/output/physics-db-demo-mobile.webm` (390×844)
- `demo/output/physics-db-demo-mobile.mp4` (if ffmpeg is installed)

Shows the hamburger menu, library search, add-to-set, and print preview on a phone viewport.

## Upscale to 4K (optional)

After recording, sharpen and upscale for portfolio / LinkedIn:

```bash
npm run demo:enhance          # desktop → physics-db-demo-4k.mp4 (3840×2160)
npm run demo:enhance:mobile   # mobile → physics-db-demo-mobile-4k.mp4 (2160×3840)
```

Uses Lanczos scaling plus a light unsharp mask, re-encoded at CRF 17.

## Options

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_BASE_URL` | `http://127.0.0.1:3456` | Site URL (skips local server if set) |
| `DEMO_PORT` | `3456` | Port for `npx serve out` |

Record against production:

```bash
DEMO_BASE_URL=https://d28e99c7v2289t.cloudfront.net npm run demo:record
```

## What it shows

1. Fresh visit (cleared localStorage) with starter set
2. Dashboard → Library → search → add problem
3. Set Builder → saved sets → preview
4. Print flow (mocked — no system print dialog)
5. Back to Set Builder

Overlays are injected at runtime via `overlay.js` (not shipped in the production build).
