'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import { AiTutorChat } from '@/components/ai/ai-tutor-chat'
import { isAiTutorConfigured } from '@/lib/ai-tutor'
import { cn } from '@/lib/utils'
import type { Problem } from '@/lib/types'

/**
 * Collapsible "Ask AI about this problem" affordance embedded in every
 * problem-detail surface (library panel, topics panel, and the mobile sheet).
 */
export function AskAiAboutProblem({ problem }: { problem: Problem }) {
  const [open, setOpen] = useState(false)
  const configured = isAiTutorConfigured()

  return (
    <section className="border-t border-border/60 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            Ask AI about this problem
            {!configured ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                Preview
              </span>
            ) : null}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            Hints, concepts, and step-by-step guidance
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div className="mt-3 h-[26rem] overflow-hidden rounded-xl border border-border/70 bg-background/60">
          <AiTutorChat problem={problem} />
        </div>
      ) : null}
    </section>
  )
}
