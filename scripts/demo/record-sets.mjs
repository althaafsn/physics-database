#!/usr/bin/env node
/**
 * Focused demo: build an exam set from the problem library → preview → print.
 *
 *   DEMO_BASE_URL=https://labfisika.com npm run demo:record:sets
 */
import { chromium } from 'playwright'
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
} from './demo-lib.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_DIR = path.join(OUT_DIR, '.tmp-sets-video')

const OUTPUT = 'physics-db-demo-sets.webm'

async function runScenario(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' })
  await sleep(1200)

  await overlay(
    page,
    'titleCard',
    'Build a Custom Exam Set',
    'Pick problems from the olympiad corpus, arrange them, and export a print-ready PDF.',
  )

  await page.getByRole('link', { name: 'Set Builder' }).click()
  await page.waitForURL(/\/sets\/?$/)
  await sleep(800)

  await page.getByRole('button', { name: 'New set' }).click()
  await sleep(800)

  await spotlightEl(page, page.getByRole('button', { name: 'New set' }), {
    caption: 'Start a new exam draft — saved automatically in your browser.',
    padding: 6,
    holdMs: 2200,
  })

  await page.getByRole('link', { name: 'Problem Library' }).click()
  await page.waitForURL('**/library/**')
  await sleep(600)

  await spotlightEl(page, page.getByPlaceholder(/Search/i), {
    caption: 'Search and filter by level, year, or topic.',
    padding: 8,
    holdMs: 2200,
  })

  const search = page.getByPlaceholder(/Search/i)
  await search.click()
  await search.fill('mekanika')
  await sleep(1000)

  const firstRow = page.locator('table tbody tr').first()
  await firstRow.waitFor({ state: 'visible', timeout: 20000 })
  await spotlightEl(page, firstRow, {
    caption: 'Open a problem to read the full statement with rendered equations.',
    padding: 4,
    holdMs: 2200,
  })
  await firstRow.click()
  await sleep(700)

  const addBtn = page.getByRole('button', { name: /^Add to set$/i })
  await addBtn.waitFor({ state: 'visible', timeout: 10000 })
  await spotlightEl(page, addBtn, {
    caption: 'Add to your active exam set with one click.',
    padding: 6,
    holdMs: 2000,
  })
  await addBtn.click()
  await sleep(800)

  // Add a second problem for a richer set
  const secondRow = page.locator('table tbody tr').nth(1)
  if (await secondRow.isVisible()) {
    await secondRow.click()
    await sleep(500)
    const add2 = page.getByRole('button', { name: /^Add to set$/i })
    if (await add2.isEnabled()) {
      await add2.click()
      await sleep(600)
    }
  }

  await page.getByRole('link', { name: 'Set Builder' }).click()
  await page.waitForURL(/\/sets\/?$/)
  await sleep(1000)

  await spotlightEl(page, page.getByRole('button', { name: 'New set' }), {
    caption: 'Saved sets live in your browser — create a new draft anytime.',
    padding: 6,
    holdMs: 2400,
  })

  await page.locator('ol.divide-y li').first().waitFor({ state: 'visible', timeout: 20000 })
  await spotlightEl(page, page.locator('ol.divide-y li').first(), {
    caption: 'Reorder problems, rename the set, or generate a random exam.',
    padding: 6,
    holdMs: 2600,
  })

  const randomBtn = page.getByRole('button', { name: /Random/i })
  if (await randomBtn.isVisible()) {
    await spotlightEl(page, randomBtn, {
      caption: 'Or auto-generate a reproducible random set from constraints.',
      padding: 6,
      holdMs: 2200,
    })
  }

  const previewBtn = page.locator('a[href="/sets/preview/"]').first()
  await previewBtn.waitFor({ state: 'visible', timeout: 15000 })
  await spotlightEl(page, previewBtn, {
    caption: 'Preview the formatted exam paper before printing.',
    padding: 6,
    holdMs: 2000,
  })
  await previewBtn.click()
  await page.waitForURL('**/sets/preview/**')
  await sleep(1200)

  await spotlightEl(page, page.locator('#exam-print-root'), {
    caption: 'KaTeX-rendered exam — same layout as your printed PDF.',
    padding: 12,
    holdMs: 3200,
  })

  const printBtn = page.getByRole('button', { name: /Print \/ Save PDF/i })
  await spotlightEl(page, printBtn, {
    caption: 'Export via Print → Save as PDF in your browser.',
    padding: 6,
    holdMs: 2400,
  })
  await printBtn.click()
  await sleep(500)

  await overlay(
    page,
    'endCard',
    'Your exam set is ready',
    'Browse, pick, arrange, and print — all without leaving the browser.',
  )
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const server = await startStaticServer()
  const browser = await chromium.launch({ headless: true })
  const { context, page } = await createRecordingContext(browser, { videoDir: VIDEO_DIR })

  console.log(`Recording set-builder demo at ${VIEWPORT.width}×${VIEWPORT.height} against ${BASE_URL}…`)
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
