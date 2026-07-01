#!/usr/bin/env node
/** Export Halliday tags + similarity neighbors to public/data for the static site. */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const parsedHalliday = path.join(root, 'parsed', 'halliday')
const outDir = path.join(root, 'public', 'data', 'halliday')

async function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return []
  const rows = []
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (trimmed) rows.push(JSON.parse(trimmed))
  }
  return rows
}

async function main() {
  const tagsPath = path.join(parsedHalliday, 'tags.jsonl')
  const simPath = path.join(parsedHalliday, 'similarity.jsonl')
  const manifestPath = path.join(parsedHalliday, 'similarity-manifest.json')

  if (!fs.existsSync(tagsPath)) {
    console.warn('No halliday tags found — run: python scripts/tag_halliday.py')
    return
  }

  fs.mkdirSync(outDir, { recursive: true })

  const tags = await readJsonl(tagsPath)
  const tagsById = Object.fromEntries(tags.map((t) => [t.problem_id, t]))
  fs.writeFileSync(path.join(outDir, 'tags.json'), JSON.stringify(tagsById))

  if (fs.existsSync(simPath)) {
    const similar = await readJsonl(simPath)
    const similarById = Object.fromEntries(similar.map((row) => [row.id, row.similar]))
    fs.writeFileSync(path.join(outDir, 'similarity.json'), JSON.stringify(similarById))
  }

  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, path.join(outDir, 'manifest.json'))
  }

  const taxonomySrc = path.join(root, 'data', 'physics-tags-taxonomy.json')
  const legacyTaxonomy = path.join(root, 'data', 'halliday-taxonomy.json')
  if (fs.existsSync(taxonomySrc)) {
    fs.copyFileSync(taxonomySrc, path.join(outDir, 'taxonomy.json'))
  } else if (fs.existsSync(legacyTaxonomy)) {
    fs.copyFileSync(legacyTaxonomy, path.join(outDir, 'taxonomy.json'))
  }

  console.log(
    JSON.stringify({
      tags: tags.length,
      output: outDir,
    }),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
