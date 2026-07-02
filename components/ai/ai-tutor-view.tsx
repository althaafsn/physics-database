'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { BookOpen, Search, Sparkles, X } from 'lucide-react'
import { problemsFetcher } from '@/lib/api'
import { problemsSwrKey } from '@/lib/data-source'
import { PageHeader } from '@/components/page-header'
import { AiTutorWorkspace } from '@/components/ai/ai-tutor-workspace'
import { LevelBadge } from '@/components/status-badges'
import { useLocale } from '@/components/locale-provider'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Problem } from '@/lib/types'

interface ProblemsResponse {
  total: number
  problems: Problem[]
}

export function AiTutorView() {
  const { locale } = useLocale()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Problem | null>(null)

  const params = new URLSearchParams()
  if (query) params.set('q', query)
  const { data, isLoading } = useSWR<ProblemsResponse>(
    problemsSwrKey(locale, params),
    problemsFetcher,
  )
  const problems = (data?.problems ?? []).slice(0, 80)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="AI Tutor"
        description="Get Socratic hints and concept help — optionally tied to a specific olympiad problem."
      />

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,18rem)_1fr] xl:grid-cols-[minmax(0,20rem)_1fr] lg:grid-rows-1">
        <aside className="flex min-h-0 flex-col border-b border-border/80 bg-card/40 lg:border-r lg:border-b-0">
          <div className="space-y-3 border-b border-border/60 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <p className="text-xs font-semibold text-foreground">
                Focus on a problem
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional)
                </span>
              </p>
            </div>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ID, title, or topic…"
                className="border-0 bg-muted/40 pl-9 shadow-none ring-1 ring-border/60"
              />
            </div>
            {selected ? (
              <div className="space-y-1 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-primary uppercase">
                      Active problem
                    </p>
                    <p className="font-mono text-xs text-foreground">{selected.id}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-foreground/90">
                      {selected.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Clear focused problem"
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground text-pretty">
                No problem selected — you can still ask general physics questions
                in the chat.
              </p>
            )}
          </div>

          <ul className="max-h-48 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
            {isLoading ? (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                Loading problems…
              </li>
            ) : problems.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground text-pretty">
                {query
                  ? 'No problems match your search.'
                  : 'No problems available.'}
              </li>
            ) : (
              problems.map((p) => {
                const isSelected = selected?.id === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
                      className={cn(
                        'w-full border-b border-border/40 px-3 py-3 text-left transition-colors sm:px-4',
                        isSelected
                          ? 'border-l-2 border-l-primary bg-primary/8'
                          : 'border-l-2 border-l-transparent hover:bg-muted/35',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {p.id}
                        </span>
                        <LevelBadge level={p.level} />
                      </div>
                      <p
                        className={cn(
                          'mt-0.5 line-clamp-2 text-sm leading-snug',
                          isSelected
                            ? 'font-medium text-foreground'
                            : 'text-foreground/90',
                        )}
                      >
                        {p.title}
                      </p>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </aside>

        <AiTutorWorkspace problem={selected} />
      </div>
    </div>
  )
}
