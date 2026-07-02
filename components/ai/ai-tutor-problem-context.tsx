'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { ProblemStatementSheet } from '@/components/ai/problem-statement-sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Problem } from '@/lib/types'

/**
 * Slim sticky bar for the AI tutor page — keeps chat full-height while the
 * full problem statement lives in an on-demand slide-over.
 */
export function AiTutorProblemContext({
  problem,
  variant = 'page',
}: {
  problem: Problem
  variant?: 'page' | 'embedded'
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  // Embedded in library/topics: the statement is already on screen above chat.
  if (variant === 'embedded') return null

  return (
    <>
      <div
        className={cn(
          'sticky top-0 z-10 flex shrink-0 items-center gap-2.5 border-b border-border/70',
          'bg-card/95 px-3 py-2.5 backdrop-blur-sm sm:px-4',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] text-muted-foreground">{problem.id}</p>
          <p className="truncate text-sm font-medium leading-snug text-foreground">
            {problem.title}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => setSheetOpen(true)}
        >
          View problem
        </Button>
      </div>

      <ProblemStatementSheet
        problem={problem}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
