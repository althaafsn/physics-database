'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Minus,
  Search,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Shuffle,
  Wand2,
  FileOutput,
  Printer,
  Trash2,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { catalogFetcher, problemsFetcher } from '@/lib/api'
import { problemsSwrKey } from '@/lib/data-source'
import { generateRandomProblemIds, pickProblemsByIds } from '@/lib/random-set'
import { PageHeader } from '@/components/page-header'
import { ProblemDetailSheet } from '@/components/problem-detail-sheet'
import { LevelBadge } from '@/components/status-badges'
import { SetHistoryPanel } from '@/components/sets/set-history-panel'
import { useSetBuilder } from '@/components/set-builder-provider'
import { useLocale } from '@/components/locale-provider'
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

const YEARS = ['2020', '2021', '2022', '2023', '2024']

export function SetBuilderView() {
  const {
    name,
    setName,
    mode,
    setMode,
    items,
    setId,
    add,
    remove,
    move,
    has,
    replaceAll,
    clear,
    isReady,
  } = useSetBuilder()
  const { locale } = useLocale()
  const router = useRouter()

  const canPreview = Boolean(setId) && (!isReady || items.length > 0)
  const hasActiveSet = Boolean(setId)

  const [query, setQuery] = useState('')
  const [previewProblem, setPreviewProblem] = useState<Problem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const params = new URLSearchParams()
  if (query) params.set('q', query)
  const { data } = useSWR<ProblemsResponse>(
    problemsSwrKey(locale, params),
    problemsFetcher,
  )
  const pool = data?.problems ?? []

  const [rLevel, setRLevel] = useState('all')
  const [rYear, setRYear] = useState('all')
  const [rTopic, setRTopic] = useState('all')
  const [count, setCount] = useState(5)
  const [seed, setSeed] = useState('42')
  const [generating, setGenerating] = useState(false)

  const openPreview = (problem: Problem) => {
    setPreviewProblem(problem)
    setSheetOpen(true)
  }

  const generateRandom = async () => {
    if (!hasActiveSet) {
      toast.error('Click New set before generating a draft')
      return
    }
    setGenerating(true)
    try {
      const all = (await catalogFetcher(locale)).problems
      const ids = generateRandomProblemIds(all, count, Number(seed) || 0, {
        level: rLevel === 'all' ? undefined : rLevel,
        year: rYear === 'all' ? undefined : Number(rYear),
        topic: rTopic === 'all' ? undefined : (rTopic as Topic),
      })
      replaceAll(pickProblemsByIds(all, ids))
      toast.success(`Generated ${ids.length} problems (seed ${seed})`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate set')
    } finally {
      setGenerating(false)
    }
  }

  const sheetFooter =
    previewProblem && !has(previewProblem.id) ? (
      <Button
        className="w-full"
        onClick={() => {
          add(previewProblem)
          toast.success(`Added ${previewProblem.id}`)
        }}
      >
        <Plus className="size-4" />
        Add to set
      </Button>
    ) : previewProblem && has(previewProblem.id) ? (
      <Button className="w-full" variant="secondary" disabled>
        <Check className="size-4" />
        Already in set
      </Button>
    ) : null

  const goToPrint = () => {
    router.push('/sets/preview?print=1')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Set Builder Workspace"
        description="Hand-pick, order, and compile a custom exam set."
        actions={
          <>
            <Button
              nativeButton={false}
              render={<Link href="/sets/preview" />}
              variant="outline"
              disabled={!canPreview}
            >
              <FileOutput className="size-4" />
              Preview
            </Button>
            <Button onClick={goToPrint} disabled={!canPreview}>
              <Printer className="size-4" />
              Print / Save PDF
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
        <div className="flex flex-col border-b border-border/80 lg:min-h-0 lg:overflow-hidden lg:border-r lg:border-b-0">
          <div className="space-y-3 border-b border-border/70 bg-card/40 px-4 py-4 backdrop-blur-sm">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Source Corpus Pool
            </h2>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search e.g. Newton or OSK-2020-07"
                className="border-0 bg-muted/40 pl-9 shadow-none ring-1 ring-border/60"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Mode</span>
              <div className="flex rounded-lg bg-muted/40 p-0.5 ring-1 ring-border/60 ring-inset">
                <button
                  onClick={() => setMode('manual')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    mode === 'manual'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Manual
                </button>
                <button
                  onClick={() => setMode('random')}
                  className={cn(
                    'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    mode === 'random'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Shuffle className="size-3" />
                  Random Sample
                </button>
              </div>
            </div>
          </div>

          {mode === 'random' ? (
            <div className="space-y-4 overflow-y-auto p-4">
              <p className="text-sm text-muted-foreground text-pretty">
                Set filter constraints and a target count, then generate a
                reproducible draft using the optional seed.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <PoolSelect
                  label="Level"
                  value={rLevel}
                  onChange={setRLevel}
                  options={[
                    { value: 'all', label: 'Any' },
                    { value: 'OSK', label: 'OSK' },
                    { value: 'OSP', label: 'OSP' },
                    { value: 'OSN', label: 'OSN' },
                  ]}
                />
                <PoolSelect
                  label="Year"
                  value={rYear}
                  onChange={setRYear}
                  options={[
                    { value: 'all', label: 'Any' },
                    ...YEARS.map((y) => ({ value: y, label: y })),
                  ]}
                />
                <PoolSelect
                  label="Topic"
                  value={rTopic}
                  onChange={setRTopic}
                  options={[
                    { value: 'all', label: 'Any' },
                    ...(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => ({
                      value: t,
                      label: TOPIC_LABELS[t],
                    })),
                  ]}
                />
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Target Count</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Seed (optional)</label>
                  <Input
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="42"
                  />
                </div>
              </div>
              <Button className="w-full" onClick={generateRandom} disabled={generating}>
                <Wand2 className="size-4" />
                {generating ? 'Generating…' : 'Generate Draft Set'}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {pool.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    onClick={() => openPreview(p)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.id}
                      </span>
                      <LevelBadge level={p.level} />
                    </div>
                    <p className="line-clamp-1 text-sm text-foreground">{p.title}</p>
                  </button>
                  <Button
                    variant={has(p.id) ? 'secondary' : 'outline'}
                    size="icon-sm"
                    aria-label={`Add ${p.id}`}
                    disabled={has(p.id)}
                    onClick={() => {
                      if (!hasActiveSet) {
                        toast.error('Click New set before adding problems')
                        return
                      }
                      add(p)
                      toast.success(`Added ${p.id}`)
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col lg:min-h-0 lg:overflow-hidden">
          <SetHistoryPanel />
          <div className="space-y-3 border-b border-border/70 bg-card/40 px-4 py-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Active Custom Exam Draft
              </h2>
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clear}>
                  <Trash2 className="size-3.5" />
                  Clear draft
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Set Name</label>
              <Input
                value={name}
                disabled={!hasActiveSet}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {hasActiveSet ? (
                <>
                  Mode: {mode === 'random' ? 'Seeded Random Set' : 'Mixed Custom Set'} ·{' '}
                  {items.length} problems
                </>
              ) : (
                'No active set — click New set above to start drafting.'
              )}
            </p>
          </div>

          {!isReady ? (
            <div className="flex min-h-[40vh] flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground lg:min-h-0">
              Loading saved sets…
            </div>
          ) : !hasActiveSet ? (
            <div className="flex min-h-[40vh] flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground lg:min-h-0">
              Create a set with the New set button, then add problems from the corpus pool.
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-[40vh] flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground lg:min-h-0">
              Add problems from the corpus pool to start drafting your exam.
            </div>
          ) : (
            <ol className="divide-y divide-border lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {items.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50"
                >
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                  <span className="w-5 text-sm font-medium tabular-nums text-muted-foreground">
                    {idx + 1}.
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    onClick={() => openPreview(p)}
                  >
                    <p className="font-mono text-xs text-muted-foreground">{p.id}</p>
                    <p className="line-clamp-1 text-sm text-foreground">{p.title}</p>
                  </button>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move up"
                      disabled={idx === 0}
                      onClick={() => move(idx, idx - 1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move down"
                      disabled={idx === items.length - 1}
                      onClick={() => move(idx, idx + 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${p.id}`}
                      onClick={() => remove(p.id)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <ProblemDetailSheet
        problem={previewProblem}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        footer={sheetFooter}
      />
    </div>
  )
}

function PoolSelect({
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
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger className="w-full">
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
    </div>
  )
}
