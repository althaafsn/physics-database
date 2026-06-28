import type { Level, Problem, ProblemLocale, Topic } from '@/lib/types'

export interface ProblemsResponse {
  total: number
  problems: Problem[]
}

export interface StatsResponse {
  stats: {
    totalAvailable: number
    englishAvailable?: number
    topicCounts: Record<Topic, number>
    levelCounts: Record<Level, number>
  }
}

export function catalogDataUrl(locale: ProblemLocale): string {
  return `/data/catalog.${locale}.json`
}

export function statsDataUrl(): string {
  return '/data/stats.json'
}

export function statsSwrKey(): string {
  return statsDataUrl()
}

export function starterSetsDataUrl(): string {
  return '/data/starter-sets.json'
}

export function catalogSwrKey(locale: ProblemLocale): string {
  return catalogDataUrl(locale)
}

export function problemsSwrKey(
  locale: ProblemLocale,
  params: URLSearchParams,
): string {
  const qs = params.toString()
  return qs ? `${catalogDataUrl(locale)}?${qs}` : catalogDataUrl(locale)
}

export function filterProblems(
  problems: Problem[],
  params: URLSearchParams,
  locale: ProblemLocale,
): Problem[] {
  let results = problems

  const levelParam = params.get('level')
  if (levelParam && levelParam !== 'all') {
    const levels = levelParam.split(',') as Level[]
    results = results.filter((p) => levels.includes(p.level))
  }

  const yearParam = params.get('year')
  if (yearParam && yearParam !== 'all') {
    const year = Number(yearParam)
    results = results.filter((p) => p.year === year)
  }

  const topicParam = params.get('topic')
  if (topicParam && topicParam !== 'all') {
    const topics = topicParam.split(',') as Topic[]
    results = results.filter((p) => topics.includes(p.topic))
  }

  const query = (params.get('q') ?? '').trim().toLowerCase()
  if (query) {
    results = results.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.body.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query),
    )
  }

  if (locale === 'en' && params.get('english_only') === '1') {
    results = results.filter((p) => p.hasEnglish)
  }

  return results
}

export async function fetchCatalog(
  locale: ProblemLocale,
): Promise<ProblemsResponse> {
  const res = await fetch(catalogDataUrl(locale))
  if (!res.ok) throw new Error(`Failed to load catalog (${res.status})`)
  return res.json() as Promise<ProblemsResponse>
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(statsDataUrl())
  if (!res.ok) throw new Error(`Failed to load stats (${res.status})`)
  return res.json() as Promise<StatsResponse>
}
