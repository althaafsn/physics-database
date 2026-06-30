'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { catalogFetcher } from '@/lib/api'
import {
  deleteSavedSet as deleteLocalSet,
  ensureStarterSets,
  listSavedSets,
  upsertSavedSet,
} from '@/lib/saved-sets-local'
import { pickProblemsByIds } from '@/lib/random-set'
import {
  LOCALE_STORAGE_KEY,
  parseProblemLocale,
} from '@/lib/locale'
import type { Problem, SavedProblemSet } from '@/lib/types'

const ACTIVE_SET_KEY = 'physics-db-active-set-id'

interface SetBuilderState {
  name: string
  setName: (name: string) => void
  mode: 'manual' | 'random'
  setMode: (mode: 'manual' | 'random') => void
  items: Problem[]
  ids: string[]
  setId: string | null
  savedSets: SavedProblemSet[]
  isSaving: boolean
  lastSavedAt: string | null
  isReady: boolean
  add: (problem: Problem) => void
  remove: (id: string) => void
  move: (from: number, to: number) => void
  has: (id: string) => boolean
  replaceAll: (problems: Problem[]) => void
  clear: () => void
  createNewSet: () => void
  loadSavedSet: (id: string) => Promise<void>
  deleteSavedSet: (id: string) => Promise<void>
}

const SetBuilderContext = createContext<SetBuilderState | null>(null)

export function SetBuilderProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [name, setName] = useState('Untitled Set')
  const [mode, setMode] = useState<'manual' | 'random'>('manual')
  const [items, setItems] = useState<Problem[]>([])
  const [setId, setSetId] = useState<string | null>(null)
  const [savedSets, setSavedSets] = useState<SavedProblemSet[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const skipNextSave = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshSavedSets = useCallback(() => {
    setSavedSets(listSavedSets())
  }, [])

  const persistSet = useCallback(
    (override?: {
      id?: string | null
      name?: string
      mode?: 'manual' | 'random'
      problemIds?: string[]
    }) => {
      const problemIds = override?.problemIds ?? items.map((p) => p.id)
      const targetId = override?.id ?? setId
      if (!problemIds.length && !targetId) return null

      setIsSaving(true)
      try {
        const record = upsertSavedSet({
          id: targetId,
          name: override?.name ?? name,
          mode: override?.mode ?? mode,
          problemIds,
        })
        setSetId(record.id)
        localStorage.setItem(ACTIVE_SET_KEY, record.id)
        setLastSavedAt(record.updatedAt)
        refreshSavedSets()
        return record
      } finally {
        setIsSaving(false)
      }
    },
    [items, setId, name, mode, refreshSavedSets],
  )

  /** Persist immediately — used before switching sets so debounced saves are not lost. */
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!isReady || !setId) return null
    return persistSet()
  }, [isReady, setId, persistSet])

  const loadSetMeta = useCallback(async (meta: SavedProblemSet) => {
    skipNextSave.current = true
    const locale =
      typeof window !== 'undefined'
        ? parseProblemLocale(localStorage.getItem(LOCALE_STORAGE_KEY))
        : 'id'
    const all = await catalogFetcher(locale)
    const problems = pickProblemsByIds(all.problems, meta.problemIds)

    setSetId(meta.id)
    setName(meta.name)
    setMode(meta.mode)
    setItems(problems)
    setLastSavedAt(meta.updatedAt)
    localStorage.setItem(ACTIVE_SET_KEY, meta.id)
    return problems.length
  }, [])

  const loadSavedSet = useCallback(
    async (id: string) => {
      if (id === setId) return
      flushPendingSave()
      skipNextSave.current = true
      const meta = listSavedSets().find((s) => s.id === id)
      if (!meta) return
      await loadSetMeta(meta)
      refreshSavedSets()
    },
    [setId, flushPendingSave, loadSetMeta, refreshSavedSets],
  )

  useEffect(() => {
    if (isReady) return

    const init = async () => {
      const sets = await ensureStarterSets()
      setSavedSets(sets)

      const storedId = localStorage.getItem(ACTIVE_SET_KEY)
      const preferred =
        (storedId ? sets.find((s) => s.id === storedId) : undefined) ??
        sets.find((s) => s.problemIds.length > 0) ??
        sets[0]

      if (preferred) {
        const loaded = await loadSetMeta(preferred)
        if (loaded === 0 && preferred.problemIds.length > 0) {
          const fallback = sets.find(
            (s) => s.id !== preferred.id && s.problemIds.length > 0,
          )
          if (fallback) await loadSetMeta(fallback)
        }
      }

      setIsReady(true)
    }

    void init()
  }, [isReady, loadSetMeta])

  useEffect(() => {
    if (!isReady || skipNextSave.current) {
      skipNextSave.current = false
      return
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      persistSet()
    }, 800)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [isReady, items, name, mode, setId, persistSet])

  const add = useCallback((problem: Problem) => {
    setItems((prev) =>
      prev.some((p) => p.id === problem.id) ? prev : [...prev, problem],
    )
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const move = useCallback((from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = prev.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const replaceAll = useCallback((problems: Problem[]) => {
    setItems(problems)
  }, [])

  const clear = useCallback(() => {
    setItems([])
    if (setId) {
      persistSet({ problemIds: [] })
    }
  }, [setId, persistSet])

  const createNewSet = useCallback(() => {
    flushPendingSave()
    skipNextSave.current = true
    const newName = `Untitled Set ${savedSets.length + 1}`
    setIsSaving(true)
    try {
      const record = upsertSavedSet({
        name: newName,
        mode: 'manual',
        problemIds: [],
      })
      setSetId(record.id)
      setName(record.name)
      setMode('manual')
      setItems([])
      setLastSavedAt(record.updatedAt)
      localStorage.setItem(ACTIVE_SET_KEY, record.id)
      refreshSavedSets()
    } finally {
      setIsSaving(false)
    }
  }, [savedSets.length, refreshSavedSets, flushPendingSave])

  const deleteSavedSet = useCallback(
    async (id: string) => {
      if (!deleteLocalSet(id)) return
      const remaining = listSavedSets()
      setSavedSets(remaining)

      if (setId === id) {
        if (remaining.length) {
          await loadSavedSet(remaining[0].id)
        } else {
          createNewSet()
        }
      }
    },
    [setId, loadSavedSet, createNewSet],
  )

  const value = useMemo<SetBuilderState>(
    () => ({
      name,
      setName,
      mode,
      setMode,
      items,
      ids: items.map((p) => p.id),
      setId,
      savedSets,
      isSaving,
      lastSavedAt,
      isReady,
      add,
      remove,
      move,
      has: (id: string) => items.some((p) => p.id === id),
      replaceAll,
      clear,
      createNewSet,
      loadSavedSet,
      deleteSavedSet,
    }),
    [
      name,
      mode,
      items,
      setId,
      savedSets,
      isSaving,
      lastSavedAt,
      isReady,
      add,
      remove,
      move,
      replaceAll,
      clear,
      createNewSet,
      loadSavedSet,
      deleteSavedSet,
    ],
  )

  return (
    <SetBuilderContext.Provider value={value}>
      {children}
    </SetBuilderContext.Provider>
  )
}

export function useSetBuilder() {
  const ctx = useContext(SetBuilderContext)
  if (!ctx) {
    throw new Error('useSetBuilder must be used within SetBuilderProvider')
  }
  return ctx
}
