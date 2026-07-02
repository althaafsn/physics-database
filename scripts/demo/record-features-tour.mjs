#!/usr/bin/env node
/**
 * Full feature tour for design reviews (e.g. Gemini UX audit).
 * One video covering dashboard → library → topics → AI tutor → set builder → preview.
 *
 *   DEMO_BASE_URL=https://labfisika.com npm run demo:record:features
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BASE_URL,
  OUT_DIR,
  VIEWPORT,
  createRecordingContext,
  finalizeWebm,
  overlay,
  sleep,
  spotlightEl,
  startStaticServer,
  waitForTutorReply,
} from './demo-lib.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_DIR = path.join(OUT_DIR, '.tmp-features-video')
const OUTPUT = 'physics-db-demo-features-tour.webm'

async function runScenario(page) {
  // —— Dashboard ——
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' })
  await sleep(1200)
  await overlay(
    page,
    'titleCard',
    'Bank Soal Fisika',
    'Indonesian physics olympiad corpus — browse, study with AI, build exam sets.',
  )
  await spotlightEl(page, page.locator('aside').first(), {
    caption: 'Navigate: Dashboard, Library, Topics, AI Tutor, Set Builder.',
    padding: 6,
    holdMs: 2600,
  })

  // —— Library ——
  await page.getByRole('link', { name: 'Problem Library' }).click()
  await page.waitForURL('**/library/**')
  await sleep(600)
  await spotlightEl(page, page.getByPlaceholder(/Search/i), {
    caption: '586+ problems — filter by OSK/OSP/OSN, year, topic, English.',
    padding: 8,
    holdMs: 2200,
  })
  const firstRow = page.locator('table tbody tr').first()
  await firstRow.waitFor({ state: 'visible', timeout: 20000 })
  await firstRow.click()
  await sleep(800)
  await spotlightEl(page, page.locator('article').first(), {
    caption: 'LaTeX statements, figures, sub-parts, similar problems, videos, AI tutor.',
    padding: 12,
    holdMs: 3000,
  })

  const addBtn = page.getByRole('button', { name: /^Add to set$/i })
  if (await addBtn.isEnabled()) {
    await addBtn.click()
    await sleep(600)
  }

  // —— Topics ——
  await page.getByRole('link', { name: 'Physics Topics' }).click()
  await page.waitForURL('**/topics/**')
  await sleep(1000)
  await spotlightEl(page, page.locator('aside, [class*="border-r"]').first(), {
    caption: 'Browse by Halliday-style physics taxonomy.',
    padding: 8,
    holdMs: 2400,
  })

  // —— AI Tutor ——
  await page.getByRole('link', { name: 'AI Tutor' }).click()
  await page.waitForURL('**/ai/**')
  await sleep(800)
  const problemBtn = page.locator('aside ul li button').first()
  if (await problemBtn.isVisible()) {
    await problemBtn.click()
    await sleep(600)
  }
  await spotlightEl(page, page.getByText('Problem statement').first(), {
    caption: 'Side-by-side workspace: problem left, AI chat right.',
    padding: 10,
    holdMs: 2400,
  })
  const chip = page.getByRole('button', { name: /Give me a hint/i }).first()
  if (await chip.isVisible()) {
    await chip.click()
    await waitForTutorReply(page, 120000)
  }

  // —— Set Builder ——
  await page.getByRole('link', { name: 'Set Builder' }).click()
  await page.waitForURL(/\/sets\/?$/)
  await sleep(1000)
  if (!(await page.locator('ol.divide-y li').first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'New set' }).click()
    await sleep(500)
  }
  await spotlightEl(page, page.locator('ol.divide-y li').first(), {
    caption: 'Multi-set workspace — reorder, random generate, auto-saved locally.',
    padding: 8,
    holdMs: 2600,
  })

  const previewBtn = page.locator('a[href="/sets/preview/"]').first()
  if (await previewBtn.isVisible()) {
    await previewBtn.click()
    await page.waitForURL('**/sets/preview/**')
    await sleep(1200)
    await spotlightEl(page, page.locator('#exam-print-root'), {
      caption: 'Print-ready exam paper — Save as PDF from the browser.',
      padding: 12,
      holdMs: 3000,
    })
  }

  await overlay(
    page,
    'endCard',
    'Full feature tour',
    'https://labfisika.com — study, tutor, and build exams in one place.',
  )
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const server = await startStaticServer()
  const browser = await chromium.launch({ headless: true })
  const { context, page } = await createRecordingContext(browser, { videoDir: VIDEO_DIR })

  console.log(`Recording features tour at ${VIEWPORT.width}×${VIEWPORT.height} against ${BASE_URL}…`)
  try {
    await runScenario(page)
  } finally {
    await page.close()
    await context.close()
    await browser.close()
    if (server) server.kill()
  }

  finalizeWebm(OUTPUT, VIDEO_DIR)
  fs.rmSync(VIDEO_DIR, { recursive: true, force: true })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
