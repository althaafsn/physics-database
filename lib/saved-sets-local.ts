import starterConfig from '@/data/starter-sets.json'
import type { SavedProblemSet } from '@/lib/types'

const STORAGE_KEY = 'physics-db-saved-sets'
const SEEDED_KEY = 'physics-db-starter-sets-seeded'

function readAll(): SavedProblemSet[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { sets?: SavedProblemSet[] }
    return Array.isArray(parsed.sets) ? parsed.sets : []
  } catch {
    return []
  }
}

function writeAll(sets: SavedProblemSet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sets }))
}

function newId(): string {
  return crypto.randomUUID()
}

function builtinStarters(): SavedProblemSet[] {
  const now = new Date().toISOString()
  return (starterConfig.sets ?? []).map((set) => ({
    ...set,
    createdAt: now,
    updatedAt: now,
  }))
}

export function listSavedSets(): SavedProblemSet[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function upsertSavedSet(input: {
  id?: string | null
  name: string
  mode: 'manual' | 'random'
  problemIds: string[]
}): SavedProblemSet {
  const now = new Date().toISOString()
  const sets = readAll()
  const existingIdx = input.id ? sets.findIndex((s) => s.id === input.id) : -1

  if (existingIdx >= 0) {
    const updated: SavedProblemSet = {
      ...sets[existingIdx],
      name: input.name,
      mode: input.mode,
      problemIds: input.problemIds,
      updatedAt: now,
    }
    sets[existingIdx] = updated
    writeAll(sets)
    return updated
  }

  const created: SavedProblemSet = {
    id: newId(),
    name: input.name,
    mode: input.mode,
    problemIds: input.problemIds,
    createdAt: now,
    updatedAt: now,
  }
  writeAll([created, ...sets])
  return created
}

export function deleteSavedSet(id: string): boolean {
  const sets = readAll()
  const next = sets.filter((s) => s.id !== id)
  if (next.length === sets.length) return false
  writeAll(next)
  return true
}

export async function ensureStarterSets(): Promise<SavedProblemSet[]> {
  if (typeof window === 'undefined') return []

  const existing = readAll()
  if (existing.length > 0) {
    localStorage.setItem(SEEDED_KEY, '1')
    return listSavedSets()
  }

  // First visit, or saved-set storage was cleared — always seed starters.
  try {
    const res = await fetch('/data/starter-sets.json')
    if (res.ok) {
      const json = (await res.json()) as { sets?: SavedProblemSet[] }
      const starters = json.sets ?? []
      if (starters.length) {
        const now = new Date().toISOString()
        writeAll(
          starters.map((set) => ({
            ...set,
            createdAt: set.createdAt ?? now,
            updatedAt: set.updatedAt ?? now,
          })),
        )
        localStorage.setItem(SEEDED_KEY, '1')
        return listSavedSets()
      }
    }
  } catch {
    // fall through to committed starter config
  }

  writeAll(builtinStarters())
  localStorage.setItem(SEEDED_KEY, '1')
  return listSavedSets()
}
