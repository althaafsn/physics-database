'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Plus, Check, Search, FileQuestion } from 'lucide-react'
import { toast } from 'sonner'
import { problemsFetcher } from '@/lib/api'
import { problemsSwrKey } from '@/lib/data-source'
import { PageHeader } from '@/components/page-header'
import { ProblemPreview } from '@/components/problem-preview'
import { ProblemDetailSheet } from '@/components/problem-detail-sheet'
import { LocaleTableCell } from '@/components/locale-badge'
import { useSetBuilder } from '@/components/set-builder-provider'
import { useLocale } from '@/components/locale-provider'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { TOPIC_LABELS } from '@/lib/types'
import type { Problem, Topic } from '@/lib/types'

interface ProblemsResponse {
  total: number
  problems: Problem[]
}

const YEARS = [
  '2015',
  '2016',
  '2017',
  '2018',
  '2019',
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
]

export function LibraryView() {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('all')
  const [year, setYear] = useState('all')
  const [topic, setTopic] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [englishOnly, setEnglishOnly] = useState(false)

  const isLarge = useMediaQuery('(min-width: 1024px)')
  const { add, has } = useSetBuilder()
  const { locale } = useLocale()

  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (level !== 'all') params.set('level', level)
  if (year !== 'all') params.set('year', year)
  if (topic !== 'all') params.set('topic', topic)
  if (locale === 'en' && englishOnly) params.set('english_only', '1')

  useEffect(() => {
    if (locale === 'id') setEnglishOnly(false)
  }, [locale])

  const { data, isLoading } = useSWR<ProblemsResponse>(
    problemsSwrKey(locale, params),
    problemsFetcher,
  )

  const problems = data?.problems ?? []
  const selected = problems.find((p) => p.id === selectedId) ?? null

  const handleSelect = (problem: Problem) => {
    setSelectedId(problem.id)
    if (!isLarge) {
      setSheetOpen(true)
    }
  }

  const handleAdd = (problem: Problem) => {
    add(problem)
    toast.success(`Added ${problem.id} to set`)
  }

  const addFooter = selected ? (
    <Button
      className="w-full"
      variant={has(selected.id) ? 'secondary' : 'default'}
      onClick={() => handleAdd(selected)}
    >
      {has(selected.id) ? (
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
  ) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Problem Library"
        description="Browse validated problems from the published catalog."
      />

      <div className="border-b border-border/70 bg-card/40 px-6 py-4 backdrop-blur-sm">
        <div className="surface-panel flex flex-col gap-3 p-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, bodies, or IDs..."
              className="border-0 bg-muted/40 pl-9 shadow-none ring-1 ring-border/60 focus-visible:ring-primary/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Level"
            value={level}
            onChange={setLevel}
            options={[
              { value: 'all', label: 'All Levels' },
              { value: 'OSK', label: 'OSK' },
              { value: 'OSP', label: 'OSP' },
              { value: 'OSN', label: 'OSN' },
            ]}
          />
          <FilterSelect
            label="Year"
            value={year}
            onChange={setYear}
            options={[
              { value: 'all', label: 'All Years' },
              ...YEARS.map((y) => ({ value: y, label: y })),
            ]}
          />
          <FilterSelect
            label="Topic"
            value={topic}
            onChange={setTopic}
            options={[
              { value: 'all', label: 'All Topics' },
              ...(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => ({
                value: t,
                label: TOPIC_LABELS[t],
              })),
            ]}
          />
          {locale === 'en' ? (
            <Button
              type="button"
              size="sm"
              variant={englishOnly ? 'secondary' : 'outline'}
              className="rounded-full"
              onClick={() => setEnglishOnly((v) => !v)}
            >
              {englishOnly ? 'Translated only' : 'Include untranslated'}
            </Button>
          ) : null}
          <span className="ml-auto rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {data?.total ?? 0}
            </span>{' '}
            results
          </span>
        </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_minmax(380px,440px)]">
        <div className="min-h-0 overflow-y-auto border-r border-border">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : problems.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  {locale === 'en' ? (
                    <th className="w-10 px-2 py-2.5 text-center font-medium">Lang</th>
                  ) : null}
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Topic</th>
                  <th className="w-10 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => {
                  const active = selected?.id === p.id
                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className={cn(
                        'group cursor-pointer border-b border-border/50 transition-colors duration-150',
                        active
                          ? 'bg-primary/5 shadow-[inset_3px_0_0_0_var(--primary)]'
                          : 'hover:bg-muted/40',
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {p.id}
                      </td>
                      {locale === 'en' ? (
                        <td className="px-2 py-2.5 text-center">
                          <LocaleTableCell problem={p} />
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5">
                        <span className="line-clamp-1 text-foreground">{p.title}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                        {TOPIC_LABELS[p.topic]}
                      </td>
                      <td className="px-2 py-2.5">
                        <Button
                          variant={has(p.id) ? 'secondary' : 'ghost'}
                          size="icon-sm"
                          aria-label={`Add ${p.id} to set`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAdd(p)
                          }}
                        >
                          {has(p.id) ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="hidden min-h-0 overflow-y-auto bg-transparent p-4 lg:block">
          {selected ? (
            <div className="surface-panel space-y-4 p-5">
              <ProblemPreview problem={selected} />
              {addFooter}
            </div>
          ) : (
            <div className="surface-muted flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                <FileQuestion className="size-5" />
              </div>
              <p className="max-w-xs text-sm text-muted-foreground text-pretty">
                Select a problem to preview the full statement and any diagrams
              </p>
            </div>
          )}
        </div>
      </div>

      <ProblemDetailSheet
        problem={selected}
        open={sheetOpen && !isLarge}
        onClose={() => setSheetOpen(false)}
        footer={addFooter}
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
      <SelectTrigger size="sm" className="min-w-[8rem]">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function EmptyState() {
  return (
    <div className="surface-muted m-6 flex flex-col items-center gap-3 p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/60">
        <FileQuestion className="size-5 text-muted-foreground" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        No problems match your filters. Try broadening level, year, or topic.
      </p>
    </div>
  )
}
