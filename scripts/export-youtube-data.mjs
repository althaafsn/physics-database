#!/usr/bin/env node
/** Export YouTube problem links to public/data for the static site. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const parsedDir = path.join(root, 'parsed', 'youtube')
const indexPath = path.join(parsedDir, 'links_by_problem.json')
const manifestPath = path.join(parsedDir, 'manifest.json')
const outDir = path.join(root, 'public', 'data', 'youtube')

function main() {
  if (!fs.existsSync(indexPath)) {
    console.warn('No youtube links found — run: python3 scripts/sync_dimensi_sains_youtube.py')
    return
  }

  fs.mkdirSync(outDir, { recursive: true })
  fs.copyFileSync(indexPath, path.join(outDir, 'links.json'))
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, path.join(outDir, 'manifest.json'))
  }

  const links = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  const problemCount = Object.keys(links).length
  const linkCount = Object.values(links).reduce((sum, arr) => sum + arr.length, 0)

  console.log(
    JSON.stringify({
      problemsWithVideo: problemCount,
      linkCount,
      output: outDir,
    }),
  )
}

main()
