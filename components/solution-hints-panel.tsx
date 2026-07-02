'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Eye, Lightbulb, LockOpen } from 'lucide-react'
import { TutorMarkdown } from '@/lib/tutor-markdown'
import {
  fetchFullSolution,
  fetchSolutionHints,
  fetchSolutionMeta,
  isSolutionApiConfigured,
} from '@/lib/solution-api'
import { useSolutionsIndex } from '@/hooks/use-solutions-index'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Problem } from '@/lib/types'

const STORAGE_KEY = 'physics-db-solution-progress'

type ProgressMap = Record<string, { revealed: number; full: boolean }>

function loadProgress(problemId: string): { revealed: number; full: boolean } {
  if (typeof window === 'undefined') return { revealed: 0, full: false }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { revealed: 0, full: false }
    const map = JSON.parse(raw) as ProgressMap
    return map[problemId] ?? { revealed: 0, full: false }
  } catch {
    return { revealed: 0, full: false }
  }
}

function saveProgress(problemId: string, progress: { revealed: number; full: boolean }) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const map: ProgressMap = raw ? (JSON.parse(raw) as ProgressMap) : {}
    map[problemId] = progress
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Progressive worked-solution panel: reveals chunked hints before the full answer.
 */
export function SolutionHintsPanel({ problem }: { problem: Problem }) {
  const configured = isSolutionApiConfigured()
  const { hasSolution } = useSolutionsIndex()
  const indexed = hasSolution(problem.id)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(indexed ? true : null)
  const [totalHints, setTotalHints] = useState(0)
  const [hints, setHints] = useState<string[]>([])
  const [fullMarkdown, setFullMarkdown] = useState<string | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [showFull, setShowFull] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setHints([])
    setFullMarkdown(null)
    setTotalHints(0)
    setRevealedCount(0)
    setShowFull(false)
    setError(null)
  }, [])

  useEffect(() => {
    reset()
    setOpen(false)
    if (!configured) {
      setAvailable(false)
      return
    }
    if (!indexed) {
      setAvailable(null)
      return
    }
    setAvailable(true)
  }, [problem.id, configured, indexed, reset])

  const loadMeta = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    setError(null)
    try {
      const meta = await fetchSolutionMeta(problem.id)
      if (!meta) {
        setAvailable(false)
        return
      }
      setAvailable(true)
      setTotalHints(meta.total_hints)

      const saved = loadProgress(problem.id)
      if (saved.full) {
        const full = await fetchFullSolution(problem.id)
        setFullMarkdown(full.full_markdown)
        setShowFull(true)
        setRevealedCount(full.total_hints)
        if (full.total_hints > 0) {
          const hinted = await fetchSolutionHints(problem.id, full.total_hints - 1)
          setHints(hinted.hints)
        }
      } else if (saved.revealed > 0) {
        const hinted = await fetchSolutionHints(problem.id, saved.revealed - 1)
        setHints(hinted.hints)
        setRevealedCount(saved.revealed)
      }
    } catch {
      setError('Could not load solution hints.')
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [configured, problem.id])

  useEffect(() => {
    if (open && available && totalHints === 0 && !loading) {
      void loadMeta()
    }
  }, [open, available, totalHints, loading, loadMeta])

  if (!configured || available === false) return null
  if (available === null && !indexed) return null

  const canRevealMore = !showFull && revealedCount < totalHints
  const nextHintIndex = revealedCount

  async function revealNextHint() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSolutionHints(problem.id, nextHintIndex)
      setHints(data.hints)
      setTotalHints(data.total_hints)
      const next = nextHintIndex + 1
      setRevealedCount(next)
      saveProgress(problem.id, { revealed: next, full: false })
    } catch {
      setError('Could not load the next hint.')
    } finally {
      setLoading(false)
    }
  }

  async function revealFull() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFullSolution(problem.id)
      setFullMarkdown(data.full_markdown)
      setTotalHints(data.total_hints)
      setShowFull(true)
      if (data.total_hints > 0 && hints.length < data.total_hints) {
        const hinted = await fetchSolutionHints(problem.id, data.total_hints - 1)
        setHints(hinted.hints)
      }
      setRevealedCount(data.total_hints)
      saveProgress(problem.id, { revealed: data.total_hints, full: true })
    } catch {
      setError('Could not load the full solution.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border-t border-border/60 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all sm:px-4',
          open
            ? 'border-amber-500/30 bg-amber-500/8 shadow-sm'
            : 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30 hover:bg-amber-500/10',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
          <Lightbulb className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            Worked solution
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
              Hints first
            </span>
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            Reveal step-by-step hints before the full answer for{' '}
            <span className="font-mono text-[11px]">{problem.id}</span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-3 space-y-4 rounded-xl border border-border/70 bg-background p-4 shadow-sm ring-1 ring-border/40">
            {loading && hints.length === 0 && !showFull ? (
              <p className="text-sm text-muted-foreground">Loading hints…</p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {hints.length > 0 ? (
              <ol className="space-y-4">
                {hints.map((hint, index) => (
                  <li key={index} className="space-y-2">
                    <p className="text-[11px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-400">
                      Hint {index + 1}
                      {totalHints > 0 ? (
                        <span className="font-normal text-muted-foreground normal-case">
                          {' '}
                          · {index + 1} of {totalHints}
                        </span>
                      ) : null}
                    </p>
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed">
                      <TutorMarkdown text={hint} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : !showFull && !loading ? (
              <p className="text-sm text-muted-foreground">
                Try the first hint before jumping to the full solution — it usually points at the key
                idea without giving everything away.
              </p>
            ) : null}

            {showFull && fullMarkdown ? (
              <div className="space-y-2 border-t border-border/60 pt-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-foreground uppercase">
                  <LockOpen className="size-3.5" />
                  Full solution
                </p>
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm leading-relaxed">
                  <TutorMarkdown text={fullMarkdown} />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              {canRevealMore ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={loading}
                  onClick={() => void revealNextHint()}
                >
                  <Lightbulb className="size-3.5" />
                  {revealedCount === 0 ? 'Reveal hint 1' : `Reveal hint ${revealedCount + 1}`}
                </Button>
              ) : null}

              {!showFull ? (
                <Button
                  type="button"
                  size="sm"
                  variant={canRevealMore ? 'outline' : 'default'}
                  disabled={loading}
                  onClick={() => void revealFull()}
                >
                  <Eye className="size-3.5" />
                  Show full solution
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
