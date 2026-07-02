# Demo recordings

Videos are written to `output/` by `npm run demo:record` (that folder is gitignored).

```bash
npx playwright install chromium   # first time only
npm run demo:verify               # smoke-test live site
npm run demo:record               # full tour
DEMO_BASE_URL=https://labfisika.com npm run demo:record:sets
DEMO_BASE_URL=https://labfisika.com npm run demo:record:ai-tutor
npm run demo:enhance              # optional 4K upscale (ffmpeg)
```

See [scripts/demo/README.md](../scripts/demo/README.md).
