'use client'

import { Lightbulb } from 'lucide-react'
import { useSolutionsIndex } from '@/hooks/use-solutions-index'
import { cn } from '@/lib/utils'

export function SolutionAvailableBadge({
  problemId,
  className,
}: {
  problemId: string
  className?: string
}) {
  const { hasSolution } = useSolutionsIndex()
  if (!hasSolution(problemId)) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300',
        className,
      )}
      title="Worked solution available"
    >
      <Lightbulb className="size-2.5" />
      Sol
    </span>
  )
}
