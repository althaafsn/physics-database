import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(root, 'parsed', 'catalog', 'problems.jsonl')
const catalogFallback = path.join(root, 'parsed', 'problems.jsonl')
const assetsSrc = path.join(root, 'parsed', 'assets')
const assetsDest = path.join(root, 'public', 'assets')
const dataDir = path.join(root, 'public', 'data')
const assetPrefix = '/assets'

const TOPIC_MAP = {
  mechanics: 'mechanics',
  electromagnetism: 'electromagnetism',
  thermodynamics: 'thermodynamics',
  waves_optics: 'waves',
  modern_physics: 'modern',
  mixed: 'mixed',
}

function assetUrl(relativePath) {
  const normalized = relativePath.replace(/^\/?assets\//, '').replace(/\\/g, '/')
  return `${assetPrefix}/${normalized}`
}

function rewriteMarkdownImages(text, images) {
  const byFilename = new Map()
  for (const img of images) {
    byFilename.set(img.filename, assetUrl(img.path))
    byFilename.set(img.path.replace(/\\/g, '/'), assetUrl(img.path))
  }
  return text.replace(/!\[\]\(([^)]+)\)/g, (_match, ref) => {
    const clean = ref.trim().replace(/\\/g, '/')
    const mapped =
      byFilename.get(clean) ||
      byFilename.get(clean.split('/').pop() ?? '') ||
      (clean.startsWith('assets/') ? assetUrl(clean) : null)
    return mapped ? `![](${mapped})` : `![](${ref})`
  })
}

function mapTopic(raw) {
  return TOPIC_MAP[raw.toLowerCase()] ?? 'mechanics'
}

function mapProblem(rec, locale = 'id') {
  const hasEnglish = Boolean(rec.body_md_en?.trim())
  const usingEnglish = locale === 'en' && hasEnglish
  const bodySource = usingEnglish ? rec.body_md_en : rec.body_md
  const titleSource = usingEnglish && rec.title_en?.trim() ? rec.title_en : rec.title
  const subpartsSource = usingEnglish && rec.subparts_en?.length ? rec.subparts_en : rec.subparts
  const body = rewriteMarkdownImages(bodySource, rec.images ?? [])
  const firstImage = rec.images?.[0]

  return {
    id: rec.id,
    title: titleSource,
    level: rec.level ?? 'OSK',
    year: rec.year ?? 0,
    topic: mapTopic(rec.topic ?? 'mechanics'),
    body,
    parts: (subpartsSource ?? []).map((sp) => ({
      label: sp.label,
      prompt: rewriteMarkdownImages(sp.text, rec.images ?? []),
    })),
    figure: firstImage ? assetUrl(firstImage.path) : undefined,
    quality: rec.llm_repaired ? 'repaired' : 'clean',
    needsReview: false,
    topicConfidence: rec.topic_confidence ?? 0,
    titleEn: rec.title_en?.trim() || undefined,
    bodyEn: rec.body_md_en?.trim()
      ? rewriteMarkdownImages(rec.body_md_en, rec.images ?? [])
      : undefined,
    partsEn: rec.subparts_en?.length
      ? rec.subparts_en.map((sp) => ({
          label: sp.label,
          prompt: rewriteMarkdownImages(sp.text, rec.images ?? []),
        }))
      : undefined,
    hasTranslation: Boolean(rec.llm_translated && rec.body_md_en?.trim()),
    locale,
    hasEnglish,
    usingFallback: locale === 'en' && !hasEnglish,
  }
}

function computeCorpusStats(raw) {
  const topicCounts = {
    mechanics: 0,
    electromagnetism: 0,
    thermodynamics: 0,
    waves: 0,
    optics: 0,
    modern: 0,
    mixed: 0,
  }
  const levelCounts = { OSK: 0, OSP: 0, OSN: 0 }
  let englishAvailable = 0

  for (const rec of raw) {
    topicCounts[mapTopic(rec.topic ?? 'mechanics')] += 1
    if (rec.level && rec.level in levelCounts) levelCounts[rec.level] += 1
    if (rec.body_md_en?.trim()) englishAvailable += 1
  }

  return {
    totalAvailable: raw.length,
    englishAvailable,
    topicCounts,
    levelCounts,
  }
}

async function loadRawProblems(sourcePath) {
  const records = []
  const stream = fs.createReadStream(sourcePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    records.push(JSON.parse(trimmed))
  }
  return records
}

function starterSets() {
  const starterPath = path.join(root, 'data', 'starter-sets.json')
  if (!fs.existsSync(starterPath)) {
    throw new Error('Missing data/starter-sets.json')
  }
  const now = new Date().toISOString()
  const { sets } = JSON.parse(fs.readFileSync(starterPath, 'utf8'))
  return (sets ?? []).map((set) => ({ ...set, createdAt: now, updatedAt: now }))
}

async function main() {
  const source = fs.existsSync(catalogPath) ? catalogPath : catalogFallback
  if (!fs.existsSync(source)) {
    throw new Error(`Missing catalog. Run scripts/sync_catalog.py first.`)
  }

  const raw = await loadRawProblems(source)
  const stats = computeCorpusStats(raw)
  const idProblems = raw.map((rec) => mapProblem(rec, 'id'))
  const enProblems = raw.map((rec) => mapProblem(rec, 'en'))

  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(
    path.join(dataDir, 'catalog.id.json'),
    JSON.stringify({ total: idProblems.length, problems: idProblems }),
  )
  fs.writeFileSync(
    path.join(dataDir, 'catalog.en.json'),
    JSON.stringify({ total: enProblems.length, problems: enProblems }),
  )
  fs.writeFileSync(path.join(dataDir, 'stats.json'), JSON.stringify({ stats }))
  fs.writeFileSync(
    path.join(dataDir, 'starter-sets.json'),
    JSON.stringify({ sets: starterSets() }),
  )

  if (fs.existsSync(assetsSrc)) {
    fs.mkdirSync(path.dirname(assetsDest), { recursive: true })
    fs.cpSync(assetsSrc, assetsDest, { recursive: true })
  }

  console.log(
    JSON.stringify(
      {
        catalog: idProblems.length,
        englishAvailable: stats.englishAvailable,
        assetsCopied: fs.existsSync(assetsDest),
        output: dataDir,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
