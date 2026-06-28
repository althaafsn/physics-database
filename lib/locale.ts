import type { ProblemLocale } from '@/lib/types'

export type { ProblemLocale }

export const LOCALE_STORAGE_KEY = 'physics-db-locale'

export const LOCALE_LABELS: Record<ProblemLocale, string> = {
  id: 'Indonesia',
  en: 'English',
}

export const LOCALE_SHORT: Record<ProblemLocale, string> = {
  id: 'ID',
  en: 'EN',
}

export const LOCALE_HINT: Record<ProblemLocale, string> = {
  id: 'Original Indonesian problem statements',
  en: 'English translation when available; otherwise Indonesian',
}

export function parseProblemLocale(raw: string | null | undefined): ProblemLocale {
  return raw === 'en' ? 'en' : 'id'
}

export function englishCoveragePercent(
  englishAvailable: number,
  totalAvailable: number,
): number {
  if (totalAvailable <= 0) return 0
  return Math.round((englishAvailable / totalAvailable) * 100)
}

/** Append `lang=en` when viewing the English variant of the same problem IDs. */
export function withProblemLocale(url: string, locale: ProblemLocale): string {
  if (locale === 'id') return url
  const [path, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  params.set('lang', 'en')
  const qs = params.toString()
  return qs ? `${path}?${qs}` : `${path}?lang=en`
}
