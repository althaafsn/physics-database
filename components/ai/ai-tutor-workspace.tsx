'use client'

import { useEffect, useState } from 'react'
import { FileText, MessageSquare } from 'lucide-react'
import { AiTutorChat } from '@/components/ai/ai-tutor-chat'
import { ProblemStatementContent } from '@/components/ai/problem-statement-content'
import { cn } from '@/lib/utils'
import type { Problem } from '@/lib/types'

type MobilePane = 'chat' | 'problem'

/**
 * Desktop: problem statement and chat sit side-by-side (read left, ask right).
 * Mobile: one full-height pane at a time via Chat / Problem tabs.
 */
export function AiTutorWorkspace({ problem }: { problem: Problem | null }) {
  const [mobilePane, setMobilePane] = useState<MobilePane>('chat')

  useEffect(() => {
    if (problem) setMobilePane('problem')
    else setMobilePane('chat')
  }, [problem?.id])

  if (!problem) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background/50">
        <AiTutorChat problem={null} variant="page" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background/50 lg:flex-row">
      <div
        className="flex shrink-0 border-b border-border/70 bg-muted/20 lg:hidden"
        role="tablist"
        aria-label="Tutor workspace"
      >
        <WorkspaceTab
          active={mobilePane === 'problem'}
          onClick={() => setMobilePane('problem')}
          icon={<FileText className="size-3.5" />}
          label="Problem"
        />
        <WorkspaceTab
          active={mobilePane === 'chat'}
          onClick={() => setMobilePane('chat')}
          icon={<MessageSquare className="size-3.5" />}
          label="Chat"
        />
      </div>

      <section
        role="tabpanel"
        aria-label="Problem statement"
        className={cn(
          'min-h-0 overflow-y-auto border-border/70 bg-card/30 lg:w-[min(42%,28rem)] lg:shrink-0 lg:border-r',
          mobilePane === 'problem' ? 'flex-1 lg:flex-none' : 'hidden lg:block',
        )}
      >
        <div className="sticky top-0 z-10 border-b border-border/60 bg-card/80 px-4 py-2.5 backdrop-blur-sm">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Problem statement
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <ProblemStatementContent problem={problem} />
        </div>
      </section>

      <section
        role="tabpanel"
        aria-label="Tutor chat"
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          mobilePane === 'chat' ? 'flex-1' : 'hidden lg:flex',
        )}
      >
        <AiTutorChat problem={problem} variant="page" />
      </section>
    </div>
  )
}

function WorkspaceTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-b-2 border-primary bg-background text-foreground'
          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
