'use client'

import useSWR from 'swr'
import { physicsTagsFetcher } from '@/lib/halliday'
import { catalogFetcher } from '@/lib/api'
import { catalogDataUrl } from '@/lib/data-source'
import { useLocale } from '@/components/locale-provider'
import { LevelBadge } from '@/components/status-badges'
import type { Problem } from '@/lib/types'

interface SimilarProblemsProps {
  problemId: string
  onSelect?: (problem: Problem) => void
}

export function SimilarProblems({ problemId, onSelect }: SimilarProblemsProps) {
  const { locale } = useLocale()
  const { data: tagData } = useSWR('physics-tags-data', physicsTagsFetcher, {
    revalidateOnFocus: false,
  })
  const { data: catalog } = useSWR(catalogDataUrl(locale), () => catalogFetcher(locale), {
    revalidateOnFocus: false,
  })

  const neighbors = tagData?.similarity[problemId] ?? []
  if (neighbors.length === 0) return null

  const byId = new Map((catalog?.problems ?? []).map((p) => [p.id, p]))

  return (
    <section className="space-y-3 border-t border-border/60 pt-4">
      <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Similar problems
      </h4>
      <ul className="space-y-2">
        {neighbors.map((n) => {
          const problem = byId.get(n.id)
          if (!problem) return null
          const sharedTopics = n.shared_topics ?? n.shared_chapters ?? []
          const sharedDetails = n.shared_details ?? n.shared_sections ?? []
          const sharedCount = sharedTopics.length + sharedDetails.length
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect?.(problem)}
                className="w-full rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{n.id}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {Math.round(n.score * 100)}% match
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-snug text-foreground">
                  {problem.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <LevelBadge level={problem.level} />
                  {sharedCount > 0 ? (
                    <span className="text-[10px] text-muted-foreground">
                      {sharedTopics.length > 0
                        ? `${sharedTopics.length} shared topic${sharedTopics.length === 1 ? '' : 's'}`
                        : null}
                      {sharedTopics.length > 0 && sharedDetails.length > 0 ? ' · ' : null}
                      {sharedDetails.length > 0
                        ? `${sharedDetails.length} shared detail${sharedDetails.length === 1 ? '' : 's'}`
                        : null}
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
