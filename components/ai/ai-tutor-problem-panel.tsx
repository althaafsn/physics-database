'use client'

import { useState } from 'react'
import { ChevronDown, FileText } from 'lucide-react'
import { ProblemBody } from '@/components/problem-body'
import { LevelBadge } from '@/components/status-badges'
import { LocaleBadge } from '@/components/locale-badge'
import { TOPIC_LABELS, type Problem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AiTutorProblemPanelProps {
  problem: Problem
  /** Page layout: expanded reference panel. Embedded: compact, collapsible. */
  variant?: 'page' | 'embedded'
}

export function AiTutorProblemPanel({
  problem,
  variant = 'embedded',
}: AiTutorProblemPanelProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <section
      className={cn(
        'shrink-0 border-b border-border/70 bg-muted/20',
        variant === 'page' && 'bg-card/60',
      )}
      aria-label={`Problem ${problem.id}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors sm:px-4',
          'hover:bg-muted/30',
          expanded && variant === 'page' && 'border-b border-border/50',
        )}
      >
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {problem.id}
            </span>
            <LevelBadge level={problem.level} />
            <LocaleBadge problem={problem} />
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {problem.year}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">
              {TOPIC_LABELS[problem.topic]}
            </span>
          </span>
          <span
            className={cn(
              'mt-0.5 block text-sm font-medium leading-snug text-foreground text-pretty',
              !expanded && 'line-clamp-1',
            )}
          >
            {problem.title}
          </span>
          {!expanded ? (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Tap to show the full problem statement
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'mt-1 size-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div
          className={cn(
            'space-y-3 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4',
            variant === 'page'
              ? 'max-h-[min(38vh,22rem)]'
              : 'max-h-44',
          )}
        >
          <div className="text-sm leading-relaxed text-foreground/90">
            <ProblemBody text={problem.body} />
          </div>

          {problem.figure && !problem.body.includes(problem.figure) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={problem.figure}
              alt="Problem diagram"
              className="mx-auto max-h-36 max-w-full rounded-md border border-border/80 bg-background/80 object-contain p-1"
            />
          ) : null}

          {problem.parts.length > 0 ? (
            <ol className="space-y-2 border-t border-border/50 pt-3">
              {problem.parts.map((part) => (
                <li
                  key={part.label}
                  className="flex gap-2 text-sm leading-relaxed text-foreground/90"
                >
                  <span className="shrink-0 font-semibold text-primary">
                    ({part.label})
                  </span>
                  <span className="min-w-0">
                    <ProblemBody text={part.prompt} />
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
