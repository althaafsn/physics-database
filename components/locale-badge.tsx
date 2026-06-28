'use client'

import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/components/locale-provider'
import type { Problem } from '@/lib/types'

/** Shown only when English is selected but this problem has no translation yet. */
export function LocaleBadge({ problem }: { problem: Problem }) {
  const { locale } = useLocale()

  if (locale !== 'en' || !problem.usingFallback) {
    return null
  }

  return (
    <Badge
      variant="outline"
      className="border-amber-500/30 bg-amber-500/5 text-[10px] font-normal text-amber-800 dark:text-amber-300"
    >
      No English yet
    </Badge>
  )
}

export function LocaleTableCell({ problem }: { problem: Problem }) {
  const { locale } = useLocale()

  if (locale !== 'en') {
    return null
  }

  return problem.usingFallback ? (
    <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted/60 text-[10px] font-medium text-muted-foreground">
      ID
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
      EN
    </span>
  )
}
