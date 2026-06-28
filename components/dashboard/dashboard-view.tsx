'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowRight, BookOpen, Layers } from 'lucide-react'
import { statsFetcher } from '@/lib/api'
import { statsSwrKey } from '@/lib/data-source'
import { PageHeader } from '@/components/page-header'
import { useTranslationStats } from '@/components/locale-provider'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TOPIC_LABELS } from '@/lib/types'
import type { CorpusStats, Topic } from '@/lib/types'

interface StatsResponse {
  stats: CorpusStats
}

function KpiCard({
  label,
  icon: Icon,
  value,
  caption,
  accent = 'primary',
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: string
  caption: string
  accent?: 'primary' | 'chart-3'
}) {
  const iconWrap =
    accent === 'chart-3'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : 'bg-primary/10 text-primary'

  return (
    <Card className="gap-4 p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="block text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </span>
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
        >
          <Icon className="size-5" />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </Card>
  )
}

export function DashboardView() {
  const { data, isLoading } = useSWR<StatsResponse>(statsSwrKey(), statsFetcher)
  const { englishAvailable, totalAvailable, coveragePercent } = useTranslationStats()

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Dashboard"
        description="Browse the published problem catalog and build custom exam sets."
        actions={
          <Button nativeButton={false} render={<Link href="/sets" />}>
            New Exam Set
            <ArrowRight className="size-4" />
          </Button>
        }
      />

      <div className="flex-1 space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {isLoading || !data ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <KpiCard
                label="Available Problems"
                icon={BookOpen}
                value={`${data.stats.totalAvailable}`}
                caption={
                  englishAvailable > 0
                    ? `${englishAvailable} with English (${coveragePercent}%) · switch language in the sidebar`
                    : 'Clean, validated records ready for exam sets'
                }
              />
              <KpiCard
                label="Levels Covered"
                icon={Layers}
                value={Object.entries(data.stats.levelCounts)
                  .filter(([, n]) => n > 0)
                  .map(([level, n]) => `${level}: ${n}`)
                  .join(' · ')}
                caption="OSK, OSP, and OSN breakdown"
                accent="chart-3"
              />
            </>
          )}
        </div>

        <Card className="gap-0 overflow-hidden p-0 shadow-sm">
          <div className="border-b border-border/80 bg-muted/20 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Topics in Catalog</h2>
          </div>
          <ul className="divide-y divide-border/70">
            {data &&
              (Object.entries(data.stats.topicCounts) as [Topic, number][])
                .filter(([, count]) => count > 0)
                .map(([topic, count]) => {
                  const max = Math.max(
                    ...Object.values(data.stats.topicCounts).filter((n) => n > 0),
                  )
                  return (
                    <li key={topic} className="px-5 py-3.5 transition-colors hover:bg-muted/20">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {TOPIC_LABELS[topic]}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {count}
                        </span>
                      </div>
                      <Progress
                        value={Math.round((count / max) * 100)}
                        className="h-1.5"
                      />
                    </li>
                  )
                })}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return <Card className="h-36 animate-pulse bg-muted/30 p-6" />
}
