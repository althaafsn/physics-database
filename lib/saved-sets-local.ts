import type { SavedProblemSet } from '@/lib/types'

const STORAGE_KEY = 'physics-db-saved-sets'

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

/** Saved sets in stable creation order (array order in localStorage). */
export function listSavedSets(): SavedProblemSet[] {
  return readAll()
}

/** Load saved sets from localStorage. Does not auto-create starter sets. */
export async function loadSavedSets(): Promise<SavedProblemSet[]> {
  if (typeof window === 'undefined') return []
  return listSavedSets()
}

/** @deprecated Use loadSavedSets — kept for call-site compatibility. */
export async function ensureStarterSets(): Promise<SavedProblemSet[]> {
  return loadSavedSets()
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
  writeAll([...sets, created])
  return created
}

export function deleteSavedSet(id: string): boolean {
  const sets = readAll()
  const next = sets.filter((s) => s.id !== id)
  if (next.length === sets.length) return false
  writeAll(next)
  return true
}
