import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '../..')
export const OUT_DIR = path.join(ROOT, 'demo', 'output')
export const OVERLAY_SRC = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8')
export const PORT = Number(process.env.DEMO_PORT || 3456)
export const BASE_URL = process.env.DEMO_BASE_URL || `http://127.0.0.1:${PORT}`
export const VIEWPORT = {
  width: Number(process.env.DEMO_WIDTH || 1920),
  height: Number(process.env.DEMO_HEIGHT || 1080),
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function hasFfmpeg() {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
}

export async function startStaticServer() {
  if (process.env.DEMO_BASE_URL) return null

  if (!fs.existsSync(path.join(ROOT, 'out', 'index.html'))) {
    console.log('Building static site for demo…')
    spawnSync('npm', ['run', 'build:static'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_PUBLIC_AI_TUTOR_ENDPOINT:
          process.env.NEXT_PUBLIC_AI_TUTOR_ENDPOINT || 'https://api.labfisika.com/api/tutor/chat',
        NEXT_PUBLIC_ADMIN_API_URL:
          process.env.NEXT_PUBLIC_ADMIN_API_URL || 'https://api.labfisika.com',
        NEXT_PUBLIC_ENABLE_ADMIN: process.env.NEXT_PUBLIC_ENABLE_ADMIN || 'true',
      },
    })
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

export async function overlay(page, method, ...args) {
  return page.evaluate(
    ({ method, args }) => window.__demoOverlay?.[method]?.(...args),
    { method, args },
  )
}

export async function spotlightEl(page, locator, options = {}) {
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
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
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

export async function createRecordingContext(browser, { clearStorage = true, videoDir = OUT_DIR } = {}) {
  fs.mkdirSync(videoDir, { recursive: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoDir, size: VIEWPORT },
    locale: 'en-US',
  })

  if (clearStorage) {
    await context.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  }
  await context.addInitScript(OVERLAY_SRC)

  const page = await context.newPage()
  page.setDefaultTimeout(45000)
  return { context, page }
}

export function finalizeWebm(outputName, videoDir = OUT_DIR) {
  const webmFiles = fs
    .readdirSync(videoDir)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f, t: fs.statSync(path.join(videoDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)

  if (!webmFiles.length) {
    throw new Error('No video file produced')
  }

  const webmPath = path.join(videoDir, webmFiles[0].f)
  const finalWebm = path.join(OUT_DIR, outputName)
  if (webmPath !== finalWebm) {
    if (fs.existsSync(finalWebm)) fs.unlinkSync(finalWebm)
    fs.renameSync(webmPath, finalWebm)
  }

  for (const f of fs.readdirSync(videoDir)) {
    if (f.endsWith('.webm')) {
      fs.unlinkSync(path.join(videoDir, f))
    }
  }

  console.log(`\n✓ Demo video: ${finalWebm}`)

  if (hasFfmpeg()) {
    const mp4Path = finalWebm.replace(/\.webm$/, '.mp4')
    console.log('Converting to MP4…')
    spawnSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        finalWebm,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '22',
        '-pix_fmt',
        'yuv420p',
        mp4Path,
      ],
      { stdio: 'inherit' },
    )
    if (fs.existsSync(mp4Path)) {
      console.log(`✓ MP4: ${mp4Path}`)
    }
  }

  return finalWebm
}
