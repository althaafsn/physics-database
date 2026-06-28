#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('node', ['scripts/export-static-data.mjs'])

if (fs.existsSync(path.join(root, '.next'))) {
  fs.rmSync(path.join(root, '.next'), { recursive: true, force: true })
}

run('npx', ['next', 'build'])
console.log('\nStatic site ready in out/ — deploy with: ./deploy/aws/deploy.sh')
