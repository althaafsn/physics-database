'use client'

import { useEffect } from 'react'
import { FileText, X } from 'lucide-react'
import { ProblemBody } from '@/components/problem-body'
import { LevelBadge } from '@/components/status-badges'
import { LocaleBadge } from '@/components/locale-badge'
import { TOPIC_LABELS, type Problem } from '@/lib/types'

/** Full problem statement for overlay panels (tutor sheet, etc.). */
export function ProblemStatementContent({ problem }: { problem: Problem }) {
  return (
    <article className="space-y-4">
      <header className="space-y-2 border-b border-border/60 pb-4">
        <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          {problem.id}
        </p>
        <h3 className="text-lg font-semibold leading-snug text-foreground text-pretty">
          {problem.title}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <LevelBadge level={problem.level} />
          <LocaleBadge problem={problem} />
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs tabular-nums text-muted-foreground">{problem.year}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{TOPIC_LABELS[problem.topic]}</span>
        </div>
      </header>

      <div className="prose-sm max-w-none text-sm leading-relaxed text-foreground/90">
        <ProblemBody text={problem.body} />
      </div>

      {problem.figure && !problem.body.includes(problem.figure) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={problem.figure}
          alt="Problem diagram"
          className="mx-auto max-h-[min(24rem,50vh)] max-w-full rounded-lg border border-border/80 bg-muted/20 p-2 object-contain shadow-sm"
        />
      ) : null}

      {problem.parts.length > 0 ? (
        <ol className="space-y-3 border-t border-border/60 pt-4">
          {problem.parts.map((part) => (
            <li
              key={part.label}
              className="flex gap-2.5 text-sm leading-relaxed text-foreground/90"
            >
              <span className="font-semibold text-primary">({part.label})</span>
              <span>
                <ProblemBody text={part.prompt} />
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  )
}

export function ProblemStatementSheet({
  problem,
  open,
  onClose,
}: {
  problem: Problem
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close problem statement"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-problem-sheet-title"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-border/80 bg-background shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <p
                id="tutor-problem-sheet-title"
                className="truncate text-sm font-semibold text-foreground"
              >
                Problem statement
              </p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{problem.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ProblemStatementContent problem={problem} />
        </div>
      </aside>
    </div>
  )
}
