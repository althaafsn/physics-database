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
  listSavedSets,
  loadSavedSets,
  upsertSavedSet,
} from '@/lib/saved-sets-local'
import { pickProblemsByIds } from '@/lib/random-set'
import {
  LOCALE_STORAGE_KEY,
  parseProblemLocale,
} from '@/lib/locale'
import type { Problem, SavedProblemSet } from '@/lib/types'

const ACTIVE_SET_KEY = 'physics-db-active-set-id'
const AUTOSAVE_MS = 800

interface SetDraft {
  setId: string | null
  items: Problem[]
  name: string
  mode: 'manual' | 'random'
}

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
  replaceAll: (problems: Problem[], ownerSetId?: string | null) => void
  clear: () => void
  createNewSet: () => Promise<void>
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

  const skipNextAutosave = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const setIdRef = useRef<string | null>(null)
  const loadGenerationRef = useRef(0)
  const saveEpochRef = useRef(0)
  const switchChainRef = useRef<Promise<void>>(Promise.resolve())
  const draftRef = useRef<SetDraft>({
    setId: null,
    items: [],
    name: 'Untitled Set',
    mode: 'manual',
  })

  setIdRef.current = setId
  draftRef.current = { setId, items, name, mode }

  const refreshSavedSets = useCallback(() => {
    setSavedSets(listSavedSets())
  }, [])

  const cancelAutosaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [])

  const bumpSaveEpoch = useCallback(() => {
    saveEpochRef.current += 1
    cancelAutosaveTimer()
  }, [cancelAutosaveTimer])

  /** Write one set to localStorage without changing the active UI selection. */
  const writeSetToStorage = useCallback(
    (draft: SetDraft) => {
      if (!draft.setId) return null
      setIsSaving(true)
      try {
        const record = upsertSavedSet({
          id: draft.setId,
          name: draft.name,
          mode: draft.mode,
          problemIds: draft.items.map((p) => p.id),
        })
        if (draft.setId === setIdRef.current) {
          setLastSavedAt(record.updatedAt)
        }
        refreshSavedSets()
        return record
      } finally {
        setIsSaving(false)
      }
    },
    [refreshSavedSets],
  )

  const flushPendingSave = useCallback(() => {
    cancelAutosaveTimer()
    if (!isReady) return null
    return writeSetToStorage(draftRef.current)
  }, [isReady, cancelAutosaveTimer, writeSetToStorage])

  const loadSetMeta = useCallback(async (meta: SavedProblemSet, generation: number) => {
    skipNextAutosave.current = true
    const locale =
      typeof window !== 'undefined'
        ? parseProblemLocale(localStorage.getItem(LOCALE_STORAGE_KEY))
        : 'id'
    const all = await catalogFetcher(locale)
    if (generation !== loadGenerationRef.current) return 0

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
    (id: string) => {
      const run = async () => {
        if (id === setIdRef.current) return

        bumpSaveEpoch()
        flushPendingSave()
        skipNextAutosave.current = true

        const generation = ++loadGenerationRef.current
        const meta = listSavedSets().find((s) => s.id === id)
        if (!meta) return

        await loadSetMeta(meta, generation)
        refreshSavedSets()
      }

      switchChainRef.current = switchChainRef.current.then(run, run)
      return switchChainRef.current
    },
    [bumpSaveEpoch, flushPendingSave, loadSetMeta, refreshSavedSets],
  )

  const resetActiveDraft = useCallback(() => {
    bumpSaveEpoch()
    skipNextAutosave.current = true
    setSetId(null)
    setName('Untitled Set')
    setMode('manual')
    setItems([])
    setLastSavedAt(null)
    localStorage.removeItem(ACTIVE_SET_KEY)
  }, [bumpSaveEpoch])

  useEffect(() => {
    if (isReady) return

    const init = async () => {
      const sets = await loadSavedSets()
      setSavedSets(sets)

      const storedId = localStorage.getItem(ACTIVE_SET_KEY)
      const preferred = storedId ? sets.find((s) => s.id === storedId) : undefined
      const generation = ++loadGenerationRef.current

      if (preferred) {
        await loadSetMeta(preferred, generation)
      } else if (sets.length > 0) {
        await loadSetMeta(sets[0], generation)
      }

      setIsReady(true)
    }

    void init()
  }, [isReady, loadSetMeta])

  useEffect(() => {
    if (!isReady || skipNextAutosave.current) {
      skipNextAutosave.current = false
      return
    }

    const activeId = setIdRef.current
    if (!activeId) return

    cancelAutosaveTimer()
    const epoch = saveEpochRef.current
    const snapshot: SetDraft = {
      setId: activeId,
      items: draftRef.current.items,
      name: draftRef.current.name,
      mode: draftRef.current.mode,
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      if (epoch !== saveEpochRef.current) return
      if (activeId !== setIdRef.current) return
      writeSetToStorage(snapshot)
    }, AUTOSAVE_MS)

    return cancelAutosaveTimer
  }, [isReady, items, name, mode, setId, cancelAutosaveTimer, writeSetToStorage])

  const add = useCallback((problem: Problem) => {
    if (!setIdRef.current) return
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

  const replaceAll = useCallback((problems: Problem[], ownerSetId?: string | null) => {
    if (ownerSetId != null && ownerSetId !== setIdRef.current) return
    setItems(problems)
  }, [])

  const clear = useCallback(() => {
    if (!setIdRef.current) return
    bumpSaveEpoch()
    setItems([])
    writeSetToStorage({
      setId: setIdRef.current,
      items: [],
      name: draftRef.current.name,
      mode: draftRef.current.mode,
    })
    skipNextAutosave.current = true
  }, [bumpSaveEpoch, writeSetToStorage])

  const createNewSet = useCallback((): Promise<void> => {
    const run = async () => {
      bumpSaveEpoch()
      flushPendingSave()
      skipNextAutosave.current = true

      const count = listSavedSets().length
      const newName = `Untitled Set ${count + 1}`

      setIsSaving(true)
      try {
        const record = upsertSavedSet({
          name: newName,
          mode: 'manual',
          problemIds: [],
        })
        ++loadGenerationRef.current
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
    }

    switchChainRef.current = switchChainRef.current.then(run, run)
    return switchChainRef.current
  }, [bumpSaveEpoch, flushPendingSave, refreshSavedSets])

  const deleteSavedSet = useCallback(
    (id: string) => {
      const run = async () => {
        if (!deleteLocalSet(id)) return

        bumpSaveEpoch()
        const remaining = listSavedSets()
        setSavedSets(remaining)

        if (setIdRef.current === id) {
          skipNextAutosave.current = true
          if (remaining.length) {
            const generation = ++loadGenerationRef.current
            await loadSetMeta(remaining[0], generation)
            refreshSavedSets()
          } else {
            resetActiveDraft()
          }
        }
      }

      switchChainRef.current = switchChainRef.current.then(run, run)
      return switchChainRef.current
    },
    [bumpSaveEpoch, loadSetMeta, refreshSavedSets, resetActiveDraft],
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
