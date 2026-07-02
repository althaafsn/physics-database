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
  variant?: 'page' | 'embedded'
}

export function AiTutorProblemPanel({
  problem,
  variant = 'embedded',
}: AiTutorProblemPanelProps) {
  const [expanded, setExpanded] = useState(variant === 'page')

  return (
    <section
      className={cn(
        'shrink-0 border-b border-border/70 bg-gradient-to-b from-muted/30 to-muted/10',
        variant === 'page' && 'from-card/80 to-card/40',
      )}
      aria-label={`Problem ${problem.id}`}
    >
      <div className="flex items-start gap-2.5 px-3 py-3 sm:px-5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
          <FileText className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-wide text-primary/80 uppercase">
            Problem statement
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
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
          </div>
          <h3
            className={cn(
              'mt-1 text-sm font-semibold leading-snug text-foreground text-pretty',
              !expanded && 'line-clamp-2',
            )}
          >
            {problem.title}
          </h3>
          {!expanded ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Expand to read the full statement while you chat
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse problem statement' : 'Expand problem statement'}
          className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              'size-4 transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </button>
      </div>

      {expanded ? (
        <div
          className={cn(
            'space-y-3 overflow-y-auto border-t border-border/40 px-3 pb-3 sm:px-5 sm:pb-4',
            variant === 'page'
              ? 'max-h-[min(36vh,20rem)]'
              : 'max-h-40',
          )}
        >
          <div className="pt-3 text-sm leading-relaxed text-foreground/90">
            <ProblemBody text={problem.body} />
          </div>

          {problem.figure && !problem.body.includes(problem.figure) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={problem.figure}
              alt="Problem diagram"
              className="mx-auto max-h-36 max-w-full rounded-lg border border-border/80 bg-background object-contain p-2 shadow-sm"
            />
          ) : null}

          {problem.parts.length > 0 ? (
            <ol className="space-y-2.5 border-t border-border/50 pt-3">
              {problem.parts.map((part) => (
                <li
                  key={part.label}
                  className="flex gap-2.5 text-sm leading-relaxed text-foreground/90"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {part.label}
                  </span>
                  <span className="min-w-0 pt-0.5">
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
