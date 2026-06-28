'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ProblemPreview } from '@/components/problem-preview'
import { Button } from '@/components/ui/button'
import type { Problem } from '@/lib/types'

interface ProblemDetailSheetProps {
  problem: Problem | null
  open: boolean
  onClose: () => void
  footer?: React.ReactNode
}

export function ProblemDetailSheet({
  problem,
  open,
  onClose,
  footer,
}: ProblemDetailSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open || !problem) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close problem detail"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="problem-detail-title"
        className="relative flex h-full w-full max-w-xl flex-col border-l border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="problem-detail-title" className="text-sm font-semibold text-foreground">
            Problem detail
          </h2>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ProblemPreview problem={problem} />
        </div>
        {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
      </aside>
    </div>
  )
}
