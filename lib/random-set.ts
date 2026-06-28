import type { Level, Problem, Topic } from '@/lib/types'

export interface RandomSetFilters {
  level?: string
  year?: number
  topic?: string
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function filterPool(problems: Problem[], filters: RandomSetFilters): Problem[] {
  return problems.filter((p) => {
    if (filters.level && filters.level !== 'all' && p.level !== filters.level) {
      return false
    }
    if (filters.year && p.year !== filters.year) {
      return false
    }
    if (filters.topic && filters.topic !== 'all' && p.topic !== filters.topic) {
      return false
    }
    return true
  })
}

export function generateRandomProblemIds(
  problems: Problem[],
  count: number,
  seed: number,
  filters: RandomSetFilters = {},
): string[] {
  const pool = filterPool(problems, filters)
  if (count <= 0) throw new Error('Count must be positive')
  if (count > pool.length) {
    throw new Error(
      `Count ${count} exceeds matching pool size (${pool.length}). Relax filters or lower the count.`,
    )
  }

  const rng = mulberry32(seed >>> 0)
  const indices = pool.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }

  return indices
    .slice(0, count)
    .map((i) => pool[i])
    .sort((a, b) => {
      const levelCmp = a.level.localeCompare(b.level)
      if (levelCmp !== 0) return levelCmp
      if (a.year !== b.year) return a.year - b.year
      return a.id.localeCompare(b.id)
    })
    .map((p) => p.id)
}

export function pickProblemsByIds(all: Problem[], ids: string[]): Problem[] {
  const byId = new Map(all.map((p) => [p.id, p]))
  return ids.map((id) => byId.get(id)).filter((p): p is Problem => p != null)
}
