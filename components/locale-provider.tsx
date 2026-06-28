'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { catalogFetcher, problemsFetcher, statsFetcher } from '@/lib/api'
import { statsSwrKey } from '@/lib/data-source'
import {
  LOCALE_STORAGE_KEY,
  englishCoveragePercent,
  type ProblemLocale,
  withProblemLocale,
} from '@/lib/locale'
import { useSetBuilder } from '@/components/set-builder-provider'
import type { Problem } from '@/lib/types'

interface LocaleContextValue {
  locale: ProblemLocale
  isHydrated: boolean
  setLocale: (locale: ProblemLocale) => void
  problemsUrl: (path: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

interface ProblemsResponse {
  problems: Problem[]
}

function SetBuilderLocaleSync() {
  const { locale } = useLocale()
  const { ids, replaceAll } = useSetBuilder()
  const idKey = ids.join(',')

  useEffect(() => {
    if (!ids.length) return

    let cancelled = false
    catalogFetcher(locale)
      .then((data: ProblemsResponse) => {
        if (cancelled) return
        const byId = new Map(data.problems.map((p) => [p.id, p]))
        const next = ids
          .map((id) => byId.get(id))
          .filter((p): p is Problem => p != null)
        if (next.length) replaceAll(next)
      })
      .catch(() => {
        // Keep current set items if refresh fails
      })

    return () => {
      cancelled = true
    }
  }, [locale, idKey, ids, replaceAll])

  return null
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<ProblemLocale>('id')
  const [isHydrated, setIsHydrated] = useState(false)
  const { mutate } = useSWRConfig()

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'en' || stored === 'id') {
      setLocaleState(stored)
    }
    setIsHydrated(true)
  }, [])

  const setLocale = useCallback(
    (next: ProblemLocale) => {
      setLocaleState((prev) => {
        if (prev === next) return prev
        localStorage.setItem(LOCALE_STORAGE_KEY, next)
        void mutate(
          (key) =>
            typeof key === 'string' &&
            (key.startsWith('/data/catalog.')),
        )
        return next
      })
    },
    [mutate],
  )

  const problemsUrl = useCallback(
    (path: string) => withProblemLocale(path, locale),
    [locale],
  )

  const value = useMemo(
    () => ({ locale, isHydrated, setLocale, problemsUrl }),
    [locale, isHydrated, setLocale, problemsUrl],
  )

  return (
    <LocaleContext.Provider value={value}>
      <SetBuilderLocaleSync />
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return ctx
}

export function useTranslationStats() {
  const { data } = useSWR<{ stats: { englishAvailable?: number; totalAvailable: number } }>(
    statsSwrKey(),
    statsFetcher,
    { refreshInterval: 60_000 },
  )
  const englishAvailable = data?.stats.englishAvailable ?? 0
  const totalAvailable = data?.stats.totalAvailable ?? 0
  return {
    englishAvailable,
    totalAvailable,
    coveragePercent: englishCoveragePercent(englishAvailable, totalAvailable),
  }
}

export { catalogSwrKey, problemsSwrKey }
