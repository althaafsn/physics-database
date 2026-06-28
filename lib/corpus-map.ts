import type {
  CorpusStats,
  Level,
  Problem,
  ProblemLocale,
  QualityState,
  Topic,
} from '@/lib/types'

export interface RawProblemRecord {
  id: string
  document_slug: string
  level: string | null
  year: number | null
  problem_number: number
  title: string
  topic: string
  topic_confidence: number
  topic_scores: Record<string, number>
  subparts: { label: string; text: string }[]
  body_md: string
  title_en?: string | null
  body_md_en?: string | null
  subparts_en?: { label: string; text: string }[]
  llm_translated?: boolean
  images: { filename: string; path: string; page?: number | null; kind?: string | null }[]
  errors: { code: string; message: string; snippet?: string | null }[]
  llm_repaired?: boolean
}

const TOPIC_MAP: Record<string, Topic> = {
  mechanics: 'mechanics',
  electromagnetism: 'electromagnetism',
  thermodynamics: 'thermodynamics',
  waves_optics: 'waves',
  modern_physics: 'modern',
  mixed: 'mixed',
}

export function assetUrl(relativePath: string, prefix = '/assets'): string {
  const normalized = relativePath.replace(/^\/?assets\//, '').replace(/\\/g, '/')
  return `${prefix}/${normalized}`
}

export function rewriteMarkdownImages(
  text: string,
  images: RawProblemRecord['images'],
  assetPrefix = '/assets',
): string {
  const byFilename = new Map<string, string>()
  for (const img of images) {
    byFilename.set(img.filename, assetUrl(img.path, assetPrefix))
    byFilename.set(img.path.replace(/\\/g, '/'), assetUrl(img.path, assetPrefix))
  }

  return text.replace(/!\[\]\(([^)]+)\)/g, (_match, ref: string) => {
    const clean = ref.trim().replace(/\\/g, '/')
    const mapped =
      byFilename.get(clean) ||
      byFilename.get(clean.split('/').pop() ?? '') ||
      (clean.startsWith('assets/') ? assetUrl(clean, assetPrefix) : null)
    return mapped ? `![](${mapped})` : `![](${ref})`
  })
}

export function mapTopic(raw: string): Topic {
  return TOPIC_MAP[raw.toLowerCase()] ?? 'mechanics'
}

function mapQuality(rec: RawProblemRecord): QualityState {
  if (rec.llm_repaired) return 'repaired'
  return 'clean'
}

export function mapProblem(
  rec: RawProblemRecord,
  locale: ProblemLocale = 'id',
  assetPrefix = '/assets',
): Problem {
  const hasEnglish = Boolean(rec.body_md_en?.trim())
  const usingEnglish = locale === 'en' && hasEnglish
  const bodySource = usingEnglish ? rec.body_md_en! : rec.body_md
  const titleSource =
    usingEnglish && rec.title_en?.trim() ? rec.title_en : rec.title
  const subpartsSource =
    usingEnglish && rec.subparts_en?.length ? rec.subparts_en : rec.subparts

  const body = rewriteMarkdownImages(bodySource, rec.images, assetPrefix)
  const firstImage = rec.images[0]

  const partsEn = rec.subparts_en?.length
    ? rec.subparts_en.map((sp) => ({
        label: sp.label,
        prompt: rewriteMarkdownImages(sp.text, rec.images, assetPrefix),
      }))
    : undefined

  return {
    id: rec.id,
    title: titleSource,
    level: (rec.level ?? 'OSK') as Level,
    year: rec.year ?? 0,
    topic: mapTopic(rec.topic),
    body,
    parts: subpartsSource.map((sp) => ({
      label: sp.label,
      prompt: rewriteMarkdownImages(sp.text, rec.images, assetPrefix),
    })),
    figure: firstImage ? assetUrl(firstImage.path, assetPrefix) : undefined,
    quality: mapQuality(rec),
    needsReview: false,
    topicConfidence: rec.topic_confidence ?? 0,
    titleEn: rec.title_en?.trim() || undefined,
    bodyEn: rec.body_md_en?.trim()
      ? rewriteMarkdownImages(rec.body_md_en, rec.images, assetPrefix)
      : undefined,
    partsEn,
    hasTranslation: Boolean(rec.llm_translated && rec.body_md_en?.trim()),
    locale,
    hasEnglish,
    usingFallback: locale === 'en' && !hasEnglish,
  }
}

export function computeCorpusStats(raw: RawProblemRecord[]): CorpusStats {
  const topicCounts: Record<Topic, number> = {
    mechanics: 0,
    electromagnetism: 0,
    thermodynamics: 0,
    waves: 0,
    optics: 0,
    modern: 0,
    mixed: 0,
  }
  const levelCounts: Record<Level, number> = { OSK: 0, OSP: 0, OSN: 0 }

  let englishAvailable = 0

  for (const rec of raw) {
    const topic = mapTopic(rec.topic)
    topicCounts[topic] = (topicCounts[topic] ?? 0) + 1
    if (rec.level && rec.level in levelCounts) {
      levelCounts[rec.level as Level] += 1
    }
    if (rec.body_md_en?.trim()) {
      englishAvailable += 1
    }
  }

  return {
    totalAvailable: raw.length,
    englishAvailable,
    topicCounts,
    levelCounts,
  }
}
