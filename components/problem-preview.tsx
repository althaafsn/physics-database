'use client'

import { ProblemBody } from '@/components/problem-body'
import { LocaleBadge } from '@/components/locale-badge'
import { LevelBadge } from '@/components/status-badges'
import { TOPIC_LABELS } from '@/lib/types'
import type { Problem } from '@/lib/types'

export function ProblemPreview({ problem }: { problem: Problem }) {
  return (
    <article className="space-y-5">
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
          <span className="text-xs text-muted-foreground">
            {TOPIC_LABELS[problem.topic]}
          </span>
        </div>
      </header>

      <div className="prose-sm max-w-none text-sm leading-relaxed text-foreground/90">
        <ProblemBody text={problem.body} />
      </div>

      {problem.figure && !problem.body.includes(problem.figure) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={problem.figure}
          alt="Problem diagram"
          className="mx-auto max-h-[min(24rem,50vh)] max-w-full rounded-lg border border-border/80 bg-muted/20 p-2 object-contain shadow-sm"
        />
      )}

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
