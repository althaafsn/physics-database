'use client'

import { cn } from '@/lib/utils'
import { LOCALE_LABELS, LOCALE_SHORT, type ProblemLocale } from '@/lib/locale'
import { useLocale, useTranslationStats } from '@/components/locale-provider'
import { Progress } from '@/components/ui/progress'

export function ProblemLanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale, isHydrated } = useLocale()
  const { englishAvailable, totalAvailable, coveragePercent } = useTranslationStats()

  return (
    <div className={cn('space-y-2.5', className)}>
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Problem language
      </p>
      <div
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1 ring-1 ring-border/60 ring-inset"
        role="group"
        aria-label="Problem language"
      >
        {(['id', 'en'] as ProblemLocale[]).map((value) => {
          const active = locale === value
          return (
            <button
              key={value}
              type="button"
              disabled={!isHydrated}
              onClick={() => setLocale(value)}
              aria-pressed={active}
              className={cn(
                'rounded-md px-2 py-2 text-xs font-medium transition-all duration-200',
                active
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/80'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="font-semibold">{LOCALE_SHORT[value]}</span>
              <span className="ml-1 font-normal opacity-80">{LOCALE_LABELS[value]}</span>
            </button>
          )
        })}
      </div>
      {locale === 'en' && totalAvailable > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Translated</span>
            <span className="tabular-nums">
              {englishAvailable}/{totalAvailable}
            </span>
          </div>
          <Progress value={coveragePercent} className="h-1" />
        </div>
      ) : null}
    </div>
  )
}
