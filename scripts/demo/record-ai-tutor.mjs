#!/usr/bin/env node
/**
 * Focused demo: AI Tutor — general chat + problem-grounded help from the library.
 *
 * Requires a live AI endpoint (record against production):
 *   DEMO_BASE_URL=https://labfisika.com npm run demo:record:ai-tutor
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_DIR = path.join(OUT_DIR, '.tmp-ai-video')
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

const OUTPUT = 'physics-db-demo-ai-tutor.webm'
const TUTOR_REPLY_TIMEOUT_MS = 60000

async function waitForTutorReply(page) {
  await page.getByText('Thinking…').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  await page
    .locator('.rounded-bl-sm.border')
    .first()
    .waitFor({ state: 'visible', timeout: TUTOR_REPLY_TIMEOUT_MS })
  await sleep(1500)
}

async function runScenario(page) {
  await page.goto(`${BASE_URL}/ai/`, { waitUntil: 'load' })
  await sleep(1200)

  await overlay(
    page,
    'titleCard',
    'AI Physics Tutor',
    'Get Socratic hints, concept explanations, and step-by-step guidance — grounded in the problem corpus.',
  )

  const previewBanner = page.getByText(/Preview mode/i)
  if (await previewBanner.isVisible()) {
    throw new Error(
      'AI Tutor is in preview mode — rebuild/deploy with NEXT_PUBLIC_AI_TUTOR_ENDPOINT or use DEMO_BASE_URL=https://labfisika.com',
    )
  }

  await spotlightEl(page, page.getByPlaceholder(/Search a problem to focus on/i), {
    caption: 'Optionally ground the chat on a specific problem from the catalog.',
    padding: 8,
    holdMs: 2400,
  })

  const chip = page.getByRole('button', { name: /Explain the work-energy theorem/i })
  if (await chip.isVisible()) {
    await spotlightEl(page, chip, {
      caption: 'One-tap starter prompts for common study questions.',
      padding: 6,
      holdMs: 2000,
    })
    await chip.click()
    await waitForTutorReply(page)
  } else {
    const textarea = page.getByPlaceholder(/Ask a physics question/i)
    await textarea.fill('Explain the work-energy theorem with a simple example.')
    await page.getByRole('button', { name: 'Send message' }).click()
    await waitForTutorReply(page)
  }

  await spotlightEl(page, page.locator('.rounded-bl-sm.border').first(), {
    caption: 'Live AI answers with LaTeX math — rate-limited for fair use.',
    padding: 10,
    holdMs: 3200,
  })

  await page.getByRole('link', { name: 'Problem Library' }).click()
  await page.waitForURL('**/library/**')
  await sleep(600)

  const firstRow = page.locator('table tbody tr').first()
  await firstRow.waitFor({ state: 'visible', timeout: 20000 })
  await firstRow.click()
  await sleep(700)

  const askAi = page.getByRole('button', { name: /Ask AI about this problem/i })
  await askAi.waitFor({ state: 'visible', timeout: 10000 })
  await spotlightEl(page, askAi, {
    caption: 'Every problem has an embedded AI tutor — expand for targeted help.',
    padding: 6,
    holdMs: 2400,
  })
  await askAi.click()
  await sleep(600)

  const hintChip = page.getByRole('button', { name: /Give me a hint to get started/i })
  if (await hintChip.isVisible()) {
    await spotlightEl(page, hintChip, {
      caption: 'Context-aware hints grounded in this specific problem.',
      padding: 6,
      holdMs: 2000,
    })
    await hintChip.click()
    await waitForTutorReply(page)
  } else {
    const embeddedInput = page.getByPlaceholder(/Ask about this problem/i)
    await embeddedInput.fill('Give me a hint to get started.')
    await page.getByRole('button', { name: 'Send message' }).click()
    await waitForTutorReply(page)
  }

  await spotlightEl(page, page.locator('.rounded-bl-sm.border').last(), {
    caption: 'Problem-grounded tutoring — honest when no verified solution is on file.',
    padding: 10,
    holdMs: 3200,
  })

  await overlay(
    page,
    'endCard',
    'Study smarter',
    'Open any problem, ask for a hint, and build intuition step by step.',
  )
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const server = await startStaticServer()
  const browser = await chromium.launch({ headless: true })
  const { context, page } = await createRecordingContext(browser, { videoDir: VIDEO_DIR })

  console.log(`Recording AI tutor demo at ${VIEWPORT.width}×${VIEWPORT.height} against ${BASE_URL}…`)
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
