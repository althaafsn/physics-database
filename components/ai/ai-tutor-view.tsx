'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Search, Sparkles, X } from 'lucide-react'
import { problemsFetcher } from '@/lib/api'
import { problemsSwrKey } from '@/lib/data-source'
import { PageHeader } from '@/components/page-header'
import { AiTutorChat } from '@/components/ai/ai-tutor-chat'
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
  const { data } = useSWR<ProblemsResponse>(
    problemsSwrKey(locale, params),
    problemsFetcher,
  )
  const problems = (data?.problems ?? []).slice(0, 80)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="AI Tutor"
        description="Ask for hints, concept explanations, and step-by-step guidance — optionally grounded in a specific problem."
      />

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[320px_1fr] lg:grid-rows-1">
        <aside className="flex min-h-0 flex-col border-b border-border bg-card/30 lg:border-r lg:border-b-0">
          <div className="space-y-2.5 border-b border-border/70 p-3">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Ground the conversation
            </p>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a problem to focus on…"
                className="border-0 bg-muted/40 pl-9 shadow-none ring-1 ring-border/60"
              />
            </div>
            {selected ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                <Sparkles className="size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  Focused on{' '}
                  <span className="font-mono">{selected.id}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Clear focused problem"
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground text-pretty">
                Optional — pick a problem for targeted help, or just start
                asking general physics questions.
              </p>
            )}
          </div>

          <ul className="max-h-52 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
            {problems.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className={cn(
                    'w-full border-b border-border/50 px-3 py-2.5 text-left transition-colors',
                    selected?.id === p.id
                      ? 'bg-primary/5'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {p.id}
                    </span>
                    <LevelBadge level={p.level} />
                  </div>
                  <p className="line-clamp-1 text-sm text-foreground">
                    {p.title}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-h-0">
          <AiTutorChat problem={selected} variant="page" />
        </div>
      </div>
    </div>
  )
}
