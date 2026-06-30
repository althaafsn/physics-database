#!/usr/bin/env node
/**
 * Mobile product demo (390×844 — iPhone-class viewport).
 *
 * Usage:
 *   npm run demo:record:mobile
 *   DEMO_BASE_URL=https://d28e99c7v2289t.cloudfront.net npm run demo:record:mobile
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.join(ROOT, 'demo', 'output')
const OVERLAY_SRC = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8')
const PORT = Number(process.env.DEMO_PORT || 3456)
const BASE_URL = process.env.DEMO_BASE_URL || `http://127.0.0.1:${PORT}`
const VIEWPORT = { width: 390, height: 844 }

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function hasFfmpeg() {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
}

async function startStaticServer() {
  if (process.env.DEMO_BASE_URL) return null

  if (!fs.existsSync(path.join(ROOT, 'out', 'index.html'))) {
    console.log('Building static site for demo…')
    spawnSync('npm', ['run', 'build:static'], { cwd: ROOT, stdio: 'inherit' })
  }

  const proc = spawn('npx', ['serve', 'out', '-p', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE_URL}/`)
      if (res.ok) return proc
    } catch {
      /* retry */
    }
    await sleep(250)
  }

  proc.kill()
  throw new Error(`Static server did not start on ${BASE_URL}`)
}

async function overlay(page, method, ...args) {
  return page.evaluate(
    ({ method, args }) => window.__demoOverlay?.[method]?.(...args),
    { method, args },
  )
}

async function spotlightEl(page, locator, options = {}) {
  const handle = await locator.elementHandle()
  if (!handle) {
    if (options.caption) {
      await overlay(page, 'caption', options.caption, options.holdMs ?? 2200)
    }
    return false
  }

  await handle.evaluate((el) => {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
  })
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  await sleep(180)

  return handle.evaluate((el, opts) => {
    const r = el.getBoundingClientRect()
    return window.__demoOverlay.spotlightRect(
      { x: r.x, y: r.y, width: r.width, height: r.height },
      opts,
    )
  }, options)
}

async function openNav(page) {
  const menu = page.getByRole('button', { name: /Open navigation menu/i })
  await menu.waitFor({ state: 'visible', timeout: 10000 })
  await menu.click()
  await sleep(400)
}

async function runMobileScenario(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' })
  await sleep(1200)

  await overlay(
    page,
    'titleCard',
    'Bank Soal Fisika',
    'Browse olympiad physics problems on your phone — search, build sets, print.',
  )

  await openNav(page)
  await spotlightEl(page, page.locator('aside').first(), {
    caption: 'Slide-out navigation: Dashboard, Library, and Set Builder.',
    padding: 6,
    holdMs: 2600,
  })

  await page.getByRole('link', { name: 'Problem Library' }).click()
  await page.waitForURL('**/library/**')
  await sleep(800)

  await spotlightEl(page, page.getByPlaceholder(/Search/i), {
    caption: 'Filter by level, year, and topic — optimized for narrow screens.',
    padding: 6,
    holdMs: 2200,
  })

  const search = page.getByPlaceholder(/Search/i)
  await search.click()
  await search.fill('mekanika')
  await sleep(1000)

  const firstRow = page.locator('table tbody tr').first()
  await firstRow.waitFor({ state: 'visible', timeout: 15000 })
  await spotlightEl(page, firstRow, {
    caption: 'Tap a row to open the full problem with rendered equations.',
    padding: 4,
    holdMs: 2200,
  })
  await firstRow.click()
  await sleep(700)

  const addBtn = page.getByRole('button', { name: /^Add to set$/i })
  await addBtn.waitFor({ state: 'visible', timeout: 10000 })
  await spotlightEl(page, addBtn, {
    caption: 'Add to your exam set with one tap.',
    padding: 6,
    holdMs: 2000,
  })
  await addBtn.click()
  await sleep(700)

  const closeSheet = page.getByRole('button', { name: /^Close$/i })
  if (await closeSheet.isVisible().catch(() => false)) {
    await closeSheet.click()
    await sleep(400)
  }

  await page.getByLabel('Open set builder').click()
  await page.waitForURL(/\/sets\/?$/)
  await sleep(1000)

  await spotlightEl(page, page.locator('ol.divide-y li').first(), {
    caption: 'Reorder problems and rename your set on mobile.',
    padding: 6,
    holdMs: 2600,
  })

  const previewBtn = page.locator('a[href="/sets/preview/"]').first()
  await previewBtn.waitFor({ state: 'visible', timeout: 15000 })
  await spotlightEl(page, previewBtn, {
    caption: 'Preview the print-ready exam paper.',
    padding: 6,
    holdMs: 2000,
  })
  await previewBtn.click()
  await page.waitForURL('**/sets/preview/**')
  await sleep(1000)

  await spotlightEl(page, page.locator('#exam-print-root'), {
    caption: 'KaTeX-rendered exam — scroll to review every problem.',
    padding: 8,
    holdMs: 3000,
  })

  const printBtn = page.getByRole('button', { name: /Print \/ Save PDF/i })
  await spotlightEl(page, printBtn, {
    caption: 'Save as PDF from your phone browser.',
    padding: 6,
    holdMs: 2200,
  })
  await printBtn.click()
  await sleep(500)

  await overlay(
    page,
    'endCard',
    'Try it on mobile',
    'Open the site on your phone and build an exam in minutes.',
  )
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const server = await startStaticServer()

  const iphone = devices['iPhone 13']
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ...iphone,
    viewport: VIEWPORT,
    recordVideo: {
      dir: OUT_DIR,
      size: VIEWPORT,
    },
    locale: 'en-US',
  })

  await context.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await context.addInitScript(OVERLAY_SRC)

  const page = await context.newPage()
  page.setDefaultTimeout(30000)

  console.log(`Recording mobile demo at ${VIEWPORT.width}×${VIEWPORT.height} against ${BASE_URL}…`)
  try {
    await runMobileScenario(page)
  } finally {
    await page.close()
    await context.close()
    await browser.close()
    if (server) server.kill()
  }

  const webmFiles = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f, t: fs.statSync(path.join(OUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)

  if (!webmFiles.length) {
    throw new Error('No video file produced')
  }

  const webmPath = path.join(OUT_DIR, webmFiles[0].f)
  const finalWebm = path.join(OUT_DIR, 'physics-db-demo-mobile.webm')
  if (fs.existsSync(finalWebm)) fs.unlinkSync(finalWebm)
  fs.renameSync(webmPath, finalWebm)

  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.webm') && f !== 'physics-db-demo-mobile.webm' && f !== 'physics-db-demo.webm') {
      fs.unlinkSync(path.join(OUT_DIR, f))
    }
  }

  console.log(`\n✓ Mobile demo: ${finalWebm}`)

  if (hasFfmpeg()) {
    const mp4Path = path.join(OUT_DIR, 'physics-db-demo-mobile.mp4')
    console.log('Converting to MP4…')
    spawnSync(
      'ffmpeg',
      ['-y', '-i', finalWebm, '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', mp4Path],
      { stdio: 'inherit' },
    )
    if (fs.existsSync(mp4Path)) {
      console.log(`✓ MP4: ${mp4Path}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
