import {
  catalogDataUrl,
  fetchCatalog,
  fetchStats,
  filterProblems,
  statsDataUrl,
  type ProblemsResponse,
  type StatsResponse,
} from '@/lib/data-source'
import type { ProblemLocale } from '@/lib/types'

export async function problemsFetcher(key: string): Promise<ProblemsResponse> {
  const [path, query = ''] = key.split('?')
  const locale: ProblemLocale = path.includes('.en.') ? 'en' : 'id'
  const catalog = await fetchCatalog(locale)
  const params = new URLSearchParams(query)
  const filtered = filterProblems(catalog.problems, params, locale)
  return { total: filtered.length, problems: filtered }
}

export async function statsFetcher(_key: string): Promise<StatsResponse> {
  return fetchStats()
}

export async function catalogFetcher(locale: ProblemLocale): Promise<ProblemsResponse> {
  return fetchCatalog(locale)
}

export { catalogDataUrl, statsDataUrl }
