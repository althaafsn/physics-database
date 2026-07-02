'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { BookOpen } from 'lucide-react'
import {
  disciplineLabel,
  normalizeTagRecord,
  physicsTagsFetcher,
  topicLabel,
} from '@/lib/halliday'
import { catalogFetcher } from '@/lib/api'
import { catalogDataUrl } from '@/lib/data-source'
import { SolutionAvailableBadge } from '@/components/solution-available-badge'
import { PageHeader } from '@/components/page-header'
import { ProblemPreview } from '@/components/problem-preview'
import { ProblemExtras } from '@/components/problem-extras'
import { useLocale } from '@/components/locale-provider'
import { cn } from '@/lib/utils'
import type { Problem } from '@/lib/types'

export function TopicsView() {
  const { locale } = useLocale()
  const [topicId, setTopicId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: tagData, isLoading: tagsLoading } = useSWR(
    'physics-tags-data',
    physicsTagsFetcher,
    { revalidateOnFocus: false },
  )
  const { data: catalog, isLoading: catalogLoading } = useSWR(
    catalogDataUrl(locale),
    () => catalogFetcher(locale),
    { revalidateOnFocus: false },
  )

  const problemsByTopic = useMemo(() => {
    const map = new Map<string, Problem[]>()
    if (!tagData?.tags || !catalog?.problems) return map
    for (const problem of catalog.problems) {
      const tags = normalizeTagRecord(tagData.tags[problem.id])
      if (!tags) continue
      for (const topic of tags.topics) {
        const list = map.get(topic) ?? []
        list.push(problem)
        map.set(topic, list)
      }
    }
    return map
  }, [tagData?.tags, catalog?.problems])

  const topics = tagData?.taxonomy?.topics ?? []
  const activeTopic = topicId ?? topics[0]?.id ?? null
  const topicProblems = activeTopic ? (problemsByTopic.get(activeTopic) ?? []) : []
  const selected =
    topicProblems.find((p) => p.id === selectedId) ?? topicProblems[0] ?? null

  if (tagsLoading || catalogLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading physics topics…</div>
    )
  }

  if (!tagData?.taxonomy || Object.keys(tagData.tags).length === 0) {
    return (
      <div className="m-6 surface-muted p-8 text-center text-sm text-muted-foreground">
        Physics tags not available. Run{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">python3 scripts/tag_halliday.py</code>{' '}
        then export data.
      </div>
    )
  }

  const disciplineForTopic = (id: string) =>
    tagData.taxonomy?.topics.find((t) => t.id === id)?.discipline

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Physics Topics"
        description="Browse problems by topic tags. Similar problems use TF-IDF + tag overlap."
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_1fr_minmax(360px,420px)]">
        <aside className="min-h-0 overflow-y-auto border-r border-border bg-card/30 p-3">
          <p className="mb-2 px-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Topics
          </p>
          <ul className="space-y-0.5">
            {topics.map((topic) => {
              const count = problemsByTopic.get(topic.id)?.length ?? 0
              const active = topic.id === activeTopic
              return (
                <li key={topic.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTopicId(topic.id)
                      setSelectedId(null)
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <BookOpen className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="block text-xs font-medium text-foreground">
                        {topicLabel(tagData.taxonomy, topic.id)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {disciplineLabel(tagData.taxonomy, topic.discipline)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="min-h-0 overflow-y-auto border-r border-border">
          <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur-md">
            <h2 className="text-sm font-semibold text-foreground">
              {activeTopic ? topicLabel(tagData.taxonomy, activeTopic) : '—'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {activeTopic && disciplineForTopic(activeTopic)
                ? disciplineLabel(tagData.taxonomy, disciplineForTopic(activeTopic)!)
                : ''}
              {' · '}
              {topicProblems.length} problem{topicProblems.length === 1 ? '' : 's'}
            </p>
          </div>
          {topicProblems.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No tagged problems for this topic.</p>
          ) : (
            <ul>
              {topicProblems.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      'w-full border-b border-border/50 px-4 py-3 text-left transition-colors',
                      selected?.id === p.id ? 'bg-primary/5' : 'hover:bg-muted/40',
                    )}
                  >
                    <p className="font-mono text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {p.id}
                        <SolutionAvailableBadge problemId={p.id} />
                      </span>
                    </p>
                    <p className="line-clamp-2 text-sm text-foreground">{p.title}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden min-h-0 overflow-y-auto p-4 lg:block">
          {selected ? (
            <div className="surface-panel space-y-4 p-5">
              <ProblemPreview problem={selected} />
              <ProblemExtras
                problem={selected}
                onSelectSimilar={(p) => setSelectedId(p.id)}
              />
            </div>
          ) : (
            <div className="surface-muted flex h-full min-h-[12rem] items-center justify-center p-8 text-center text-sm text-muted-foreground">
              Select a problem to preview
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
