'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { BookOpen, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  disciplineLabel,
  normalizeTagRecord,
  physicsTagsFetcher,
  topicLabel,
} from '@/lib/halliday'
import { catalogFetcher } from '@/lib/api'
import { catalogDataUrl } from '@/lib/data-source'
import { PageHeader } from '@/components/page-header'
import { ProblemPreview } from '@/components/problem-preview'
import { ProblemExtras } from '@/components/problem-extras'
import { ProblemDetailSheet } from '@/components/problem-detail-sheet'
import { useLocale } from '@/components/locale-provider'
import { useSetBuilder } from '@/components/set-builder-provider'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Problem } from '@/lib/types'

export function TopicsView() {
  const { locale } = useLocale()
  const { add, has, setId } = useSetBuilder()
  const [topicId, setTopicId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const isLarge = useMediaQuery('(min-width: 1024px)')

  const handleAdd = (problem: Problem) => {
    if (!setId) {
      toast.error('Open Set Builder and click New set first')
      return
    }
    add(problem)
    toast.success(`Added ${problem.id} to set`)
  }

  const addButton = (problem: Problem) => (
    <Button
      className="w-full"
      variant={has(problem.id) ? 'secondary' : 'default'}
      onClick={() => handleAdd(problem)}
    >
      {has(problem.id) ? (
        <>
          <Check className="size-4" />
          In current set
        </>
      ) : (
        <>
          <Plus className="size-4" />
          Add to set
        </>
      )}
    </Button>
  )

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

  const handleSelectProblem = (id: string) => {
    setSelectedId(id)
    if (!isLarge) setSheetOpen(true)
  }

  if (tagsLoading || catalogLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading physics topics…</div>
    )
  }

  if (!tagData?.taxonomy || Object.keys(tagData.tags).length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title="Physics Topics"
          description="Browse problems grouped by physics topic, then jump to closely related ones."
        />
        <div className="surface-muted m-6 flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            <BookOpen className="size-5" />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Topic tags aren&apos;t available for this catalog yet. Try the{' '}
            <a href="/library" className="font-medium text-primary hover:underline">
              Problem Library
            </a>{' '}
            to browse everything in the meantime.
          </p>
        </div>
      </div>
    )
  }

  const disciplineForTopic = (id: string) =>
    tagData.taxonomy?.topics.find((t) => t.id === id)?.discipline

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Physics Topics"
        description="Browse problems grouped by physics topic, then jump to closely related ones."
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 content-start overflow-y-auto lg:grid-cols-[260px_1fr_minmax(360px,420px)] lg:content-stretch lg:overflow-hidden">
        <aside className="shrink-0 border-b border-border bg-card/30 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-3">
          <p className="hidden px-2 pt-3 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase lg:mb-2 lg:block lg:pt-0">
            Topics
          </p>
          <ul className="flex gap-1.5 overflow-x-auto p-3 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-0">
            {topics.map((topic) => {
              const count = problemsByTopic.get(topic.id)?.length ?? 0
              const active = topic.id === activeTopic
              return (
                <li key={topic.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => {
                      setTopicId(topic.id)
                      setSelectedId(null)
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm whitespace-nowrap transition-colors lg:w-full lg:items-start lg:border-transparent lg:whitespace-normal',
                      active
                        ? 'border-primary/30 bg-primary/10 text-foreground lg:border-transparent'
                        : 'border-border/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground lg:border-transparent',
                    )}
                  >
                    <BookOpen className="size-3.5 shrink-0 lg:mt-0.5" />
                    <span className="min-w-0 leading-snug lg:flex-1">
                      <span className="block text-xs font-medium text-foreground">
                        {topicLabel(tagData.taxonomy, topic.id)}
                      </span>
                      <span className="hidden text-[10px] text-muted-foreground lg:block">
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

        <div className="min-h-0 border-b border-border lg:overflow-y-auto lg:border-r lg:border-b-0">
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
                    onClick={() => handleSelectProblem(p.id)}
                    className={cn(
                      'w-full border-b border-border/50 px-4 py-3 text-left transition-colors',
                      selected?.id === p.id && isLarge
                        ? 'bg-primary/5'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <p className="font-mono text-[10px] text-muted-foreground">{p.id}</p>
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
              {addButton(selected)}
            </div>
          ) : (
            <div className="surface-muted flex h-full min-h-[12rem] items-center justify-center p-8 text-center text-sm text-muted-foreground">
              Select a problem to preview
            </div>
          )}
        </div>
      </div>

      <ProblemDetailSheet
        problem={selected}
        open={sheetOpen && !isLarge}
        onClose={() => setSheetOpen(false)}
        onSelectSimilar={(p) => handleSelectProblem(p.id)}
        footer={selected ? addButton(selected) : null}
      />
    </div>
  )
}
