#!/usr/bin/env node
/**
 * Smoke-test main reader features against DEMO_BASE_URL (default: production).
 *
 *   DEMO_BASE_URL=https://labfisika.com node scripts/demo/verify.mjs
 */
import { chromium } from 'playwright'

const BASE_URL = process.env.DEMO_BASE_URL || 'https://labfisika.com'
const API_URL = process.env.DEMO_API_URL || 'https://api.labfisika.com'

const results = []

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function checkApi() {
  console.log('\nAPI')
  try {
    const health = await fetch(`${API_URL}/health`)
    if (health.ok) pass('GET /health')
    else fail('GET /health', String(health.status))
  } catch (e) {
    fail('GET /health', e.message)
  }

  try {
    const res = await fetch(`${API_URL}/api/tutor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'One-word hint for projectile motion?' }],
        problem: null,
      }),
    })
    const data = await res.json()
    if (res.ok && typeof data.reply === 'string' && data.reply.length > 20) {
      pass('POST /api/tutor/chat', `${data.reply.length} chars`)
    } else {
      fail('POST /api/tutor/chat', data.detail || JSON.stringify(data).slice(0, 120))
    }
  } catch (e) {
    fail('POST /api/tutor/chat', e.message)
  }
}

async function checkUi(page) {
  console.log('\nReader UI')

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  if (await page.getByRole('heading', { name: /Find great physics/i }).isVisible()) {
    pass('Dashboard loads')
  } else {
    fail('Dashboard loads')
  }

  for (const label of ['Problem Library', 'AI Tutor', 'Set Builder', 'Physics Topics']) {
    const link = page.getByRole('link', { name: label, exact: true })
    if (await link.isVisible()) pass(`Nav: ${label}`)
    else fail(`Nav: ${label}`)
  }

  await page.getByRole('link', { name: 'Problem Library' }).click()
  await page.waitForURL('**/library/**')
  await page.getByPlaceholder(/Search/i).waitFor({ state: 'visible' })
  pass('Library page')

  const rows = page.locator('table tbody tr')
  await rows.first().waitFor({ state: 'visible', timeout: 20000 })
  const count = await rows.count()
  if (count > 0) pass('Library has problems', `${count} visible`)
  else fail('Library has problems')

  await rows.first().click()
  await page.getByRole('button', { name: /^Add to set$/i }).waitFor({ state: 'visible', timeout: 10000 })
  pass('Problem detail panel')

  const askAi = page.getByRole('button', { name: /Ask AI about this problem/i })
  if (await askAi.isVisible()) pass('Ask AI affordance in library')
  else fail('Ask AI affordance in library')

  await page.getByRole('link', { name: 'Set Builder' }).click()
  await page.waitForURL(/\/sets\/?$/)
  await page.getByRole('button', { name: 'New set' }).waitFor({ state: 'visible' })
  pass('Set Builder page')

  await page.getByRole('link', { name: 'AI Tutor' }).click()
  await page.waitForURL('**/ai/**')
  await page.getByRole('heading', { name: 'AI Tutor' }).waitFor({ state: 'visible' })
  pass('AI Tutor page')

  const previewBanner = page.getByText(/Preview mode/i)
  if (await previewBanner.isVisible()) {
    fail('AI Tutor endpoint configured', 'shows Preview mode banner')
  } else {
    pass('AI Tutor endpoint configured')
  }

  const textarea = page.getByPlaceholder(/Ask a physics question/i)
  await textarea.fill('Give a one-sentence hint for projectile motion.')
  await page.getByRole('button', { name: 'Send message' }).click()

  await page.getByText('Thinking…').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  try {
    await page.waitForFunction(
      () => {
        const live = document.querySelector('[aria-live="polite"]')
        const text = live?.textContent?.trim() ?? ''
        return text.length > 30 && !/aren't connected|Preview mode/i.test(text)
      },
      { timeout: 60000 },
    )
    const reply = await page.locator('[aria-live="polite"]').innerText()
    if (reply.length > 30 && !/aren't connected|Preview mode/i.test(reply)) {
      pass('AI Tutor live reply', `${reply.length} chars`)
    } else {
      fail('AI Tutor live reply', reply.slice(0, 100))
    }
  } catch (e) {
    const err = await page.locator('.text-destructive').textContent().catch(() => '')
    fail('AI Tutor live reply', err || e.message)
  }

  await page.getByRole('link', { name: 'Physics Topics' }).click()
  await page.waitForURL('**/topics/**')
  pass('Topics page')
}

async function main() {
  console.log(`Verifying ${BASE_URL} (API: ${API_URL})…`)
  await checkApi()

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await checkUi(page)
  } finally {
    await browser.close()
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('\nFailed:')
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
