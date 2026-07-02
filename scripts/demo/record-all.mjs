#!/usr/bin/env node
/**
 * Record all demo videos sequentially against production.
 *
 *   DEMO_BASE_URL=https://labfisika.com node scripts/demo/record-all.mjs
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const BASE = process.env.DEMO_BASE_URL || 'https://labfisika.com'

const SCRIPTS = [
  'record-features-tour.mjs',
  'record.mjs',
  'record-sets.mjs',
  'record-ai-tutor.mjs',
  'record-mobile.mjs',
]

for (const script of SCRIPTS) {
  console.log(`\n========== ${script} ==========\n`)
  const result = spawnSync('node', [path.join(__dirname, script)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DEMO_BASE_URL: BASE },
  })
  if (result.status !== 0) {
    console.error(`Failed: ${script}`)
    process.exit(result.status ?? 1)
  }
}

console.log('\n✓ All demo recordings finished. See demo/output/ and GEMINI-MANIFEST.md')
