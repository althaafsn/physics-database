'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, MessageCircle } from 'lucide-react'
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
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all sm:px-4',
          open
            ? 'border-primary/30 bg-primary/8 shadow-sm'
            : 'border-primary/20 bg-primary/5 hover:border-primary/30 hover:bg-primary/10',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {open ? (
            <MessageCircle className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            Ask AI about this problem
            {!configured ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                Preview
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            Hints and step-by-step guidance grounded in{' '}
            <span className="font-mono text-[11px]">{problem.id}</span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-3 flex h-[34rem] flex-col overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm ring-1 ring-border/40">
            <AiTutorChat problem={problem} />
          </div>
        </div>
      </div>
    </section>
  )
}
