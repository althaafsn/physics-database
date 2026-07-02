#!/usr/bin/env node
/**
 * Focused demo: AI Tutor — streaming chat, problem panel, embedded tutor in library.
 *
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
  waitForTutorReply,
} from './demo-lib.mjs'

const OUTPUT = 'physics-db-demo-ai-tutor.webm'

async function runScenario(page) {
  await page.goto(`${BASE_URL}/ai/`, { waitUntil: 'load' })
  await sleep(1200)

  await overlay(
    page,
    'titleCard',
    'AI Physics Tutor',
    'Streaming Socratic hints with LaTeX — optionally grounded on any olympiad problem.',
  )

  const previewBanner = page.getByText(/Preview mode/i)
  if (await previewBanner.isVisible()) {
    throw new Error(
      'AI Tutor is in preview mode — use DEMO_BASE_URL=https://labfisika.com',
    )
  }

  await spotlightEl(page, page.getByPlaceholder(/Search by ID, title, or topic/i), {
    caption: 'Pick a problem to pin the statement above the chat.',
    padding: 8,
    holdMs: 2400,
  })

  const firstProblem = page.locator('aside ul li button').first()
  await firstProblem.waitFor({ state: 'visible', timeout: 20000 })
  await firstProblem.click()
  await sleep(800)

  await spotlightEl(page, page.getByText('Problem statement').first(), {
    caption: 'Full problem body stays visible while you ask for hints.',
    padding: 10,
    holdMs: 2800,
  })

  const chip = page.getByRole('button', { name: /Give me a hint to get started/i })
  if (await chip.isVisible()) {
    await spotlightEl(page, chip, {
      caption: 'Suggested questions — answers stream in token by token.',
      padding: 6,
      holdMs: 2000,
    })
    await chip.click()
    await waitForTutorReply(page)
  } else {
    const textarea = page.getByPlaceholder(/Ask for a hint/i)
    await textarea.fill('Give me a hint to get started.')
    await page.getByRole('button', { name: 'Send message' }).click()
    await waitForTutorReply(page)
  }

  await spotlightEl(page, page.locator('[data-tutor-messages]').first(), {
    caption: 'Markdown + LaTeX rendering with avatars and streaming.',
    padding: 10,
    holdMs: 3500,
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
    caption: 'Embedded tutor on every problem — same streaming experience.',
    padding: 6,
    holdMs: 2400,
  })
  await askAi.click()
  await sleep(800)

  const hintChip = page.getByRole('button', { name: /Which physics concepts/i })
  if (await hintChip.isVisible()) {
    await hintChip.click()
    await waitForTutorReply(page)
  } else {
    const embeddedInput = page.getByPlaceholder(/Ask for a hint/i)
    await embeddedInput.fill('Which physics concepts does this test?')
    await page.getByRole('button', { name: 'Send message' }).click()
    await waitForTutorReply(page)
  }

  await spotlightEl(page, page.locator('[data-tutor-messages]').last(), {
    caption: 'Problem-grounded help — honest when no verified solution is on file.',
    padding: 10,
    holdMs: 3200,
  })

  await overlay(
    page,
    'endCard',
    'Study smarter',
    'Read the problem, ask for a hint, practice similar questions.',
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
