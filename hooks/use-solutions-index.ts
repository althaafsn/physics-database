'use client'

import useSWR from 'swr'
import { fetchSolutionsIndex } from '@/lib/solution-api'

export function useSolutionsIndex() {
  const { data } = useSWR('solutions-index', fetchSolutionsIndex, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const ids = data ?? new Set<string>()

  return {
    ids,
    hasSolution: (problemId: string) => ids.has(problemId),
    count: ids.size,
  }
}
