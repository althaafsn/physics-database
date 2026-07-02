'use client'

import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Layers,
  FlaskConical,
  Library,
  Shuffle,
  Sparkles,
} from 'lucide-react'
import { statsFetcher } from '@/lib/api'
import { statsSwrKey } from '@/lib/data-source'
import { useTranslationStats } from '@/components/locale-provider'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TOPIC_LABELS } from '@/lib/types'
import type { Topic } from '@/lib/types'

const QUICK_ACTIONS = [
  {
    href: '/library',
    icon: Library,
    title: 'Browse the library',
    description: 'Search and filter validated problems by level, year, and topic.',
  },
  {
    href: '/ai',
    icon: Sparkles,
    title: 'Ask the AI tutor',
    description: 'Get hints, concept explanations, and step-by-step guidance.',
  },
  {
    href: '/sets',
    icon: FlaskConical,
    title: 'Build an exam set',
    description: 'Hand-pick problems, reorder them, and export a print-ready paper.',
  },
  {
    href: '/sets',
    icon: Shuffle,
    title: 'Generate a random set',
    description: 'Get a reproducible draft from a seed with your chosen constraints.',
  },
]

function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
}: (typeof QUICK_ACTIONS)[number]) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-5" />
        </div>
        <h3 className="flex items-center gap-1 text-sm font-semibold text-foreground">
          {title}
          <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      </Card>
    </Link>
  )
}

function StatPill({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string
  value: string
  caption: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="gap-4 p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="block text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </span>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </Card>
  )
}

export function DashboardView() {
  const { data, isLoading } = useSWR(statsSwrKey(), statsFetcher)
  const { englishAvailable, coveragePercent } = useTranslationStats()
  const total = data?.stats.totalAvailable

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Hero */}
      <section className="border-b border-border/70 px-6 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Indonesian Physics Olympiad corpus
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
            Find great physics problems and build your own exam in minutes
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
            Browse a curated catalog of validated OSK, OSP, and OSN problems —
            complete with rendered equations — then assemble a custom,
            print-ready problem set without any setup.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button nativeButton={false} render={<Link href="/library" />} size="lg">
              <BookOpen className="size-4" />
              Browse the library
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/sets" />}
              variant="outline"
              size="lg"
            >
              Build an exam set
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8 sm:px-10">
        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
            Get started
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard key={action.title} {...action} />
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            At a glance
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {isLoading || !data ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <StatPill
                  label="Available problems"
                  icon={BookOpen}
                  value={`${data.stats.totalAvailable}`}
                  caption={
                    englishAvailable > 0
                      ? `${englishAvailable} with English (${coveragePercent}%) · switch language in the sidebar`
                      : 'Clean, validated records ready for exam sets'
                  }
                />
                <StatPill
                  label="Levels covered"
                  icon={Layers}
                  value={Object.entries(data.stats.levelCounts)
                    .filter(([, n]) => n > 0)
                    .map(([level, n]) => `${level}: ${n}`)
                    .join(' · ')}
                  caption="OSK, OSP, and OSN breakdown"
                />
              </>
            )}
          </div>
        </section>

        {/* Topics */}
        <Card className="gap-0 overflow-hidden p-0 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Topics in catalog</h2>
            {total ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {total} total
              </span>
            ) : null}
          </div>
          <ul className="divide-y divide-border/70">
            {data &&
              (Object.entries(data.stats.topicCounts) as [Topic, number][])
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([topic, count]) => {
                  const max = Math.max(
                    ...Object.values(data.stats.topicCounts).filter((n) => n > 0),
                  )
                  return (
                    <li
                      key={topic}
                      className="px-5 py-3.5 transition-colors hover:bg-muted/20"
                    >
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {TOPIC_LABELS[topic]}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{count}</span>
                      </div>
                      <Progress value={Math.round((count / max) * 100)} className="h-1.5" />
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
