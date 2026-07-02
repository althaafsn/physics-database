import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { IngestPhase, QualityState } from '@/lib/types'

const PHASE_STYLES: Record<IngestPhase, string> = {
  pdf_only: 'bg-status-pdf text-status-pdf-foreground',
  bronze_ready: 'bg-status-bronze text-status-bronze-foreground',
  silver_done: 'bg-status-silver text-status-silver-foreground',
  gold_done: 'bg-status-gold text-status-gold-foreground',
}

export function PhaseBadge({
  phase,
  className,
}: {
  phase: IngestPhase
  className?: string
}) {
  return (
    <Badge
      className={cn('font-mono tabular-nums', PHASE_STYLES[phase], className)}
    >
      {phase}
    </Badge>
  )
}

const QUALITY_STYLES: Record<QualityState, string> = {
  clean: 'bg-quality-clean text-quality-clean-foreground',
  error: 'bg-quality-error text-quality-error-foreground',
  repaired: 'bg-quality-repaired text-quality-repaired-foreground',
}

const QUALITY_LABELS: Record<QualityState, string> = {
  clean: 'clean',
  error: 'error',
  repaired: 'repaired',
}

export function QualityBadge({
  quality,
  className,
}: {
  quality: QualityState
  className?: string
}) {
  return (
    <Badge className={cn(QUALITY_STYLES[quality], className)}>
      {QUALITY_LABELS[quality]}
    </Badge>
  )
}

export function SolutionStatusBadge({
  status,
  className,
}: {
  status: 'verified' | 'needs_review' | null
  className?: string
}) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn('text-muted-foreground', className)}>
        no solution
      </Badge>
    )
  }
  return (
    <Badge
      className={cn(
        status === 'verified'
          ? 'bg-quality-clean text-quality-clean-foreground'
          : 'bg-quality-error text-quality-error-foreground',
        className,
      )}
    >
      {status === 'verified' ? 'solution verified' : 'needs review'}
    </Badge>
  )
}

export function LevelBadge({
  level,
  className,
}: {
  level: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-md border-border/80 bg-background/80 font-mono text-[10px] tracking-wide',
        className,
      )}
    >
      {level}
    </Badge>
  )
}
