'use client'

import { Clock, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSetBuilder } from '@/components/set-builder-provider'
import { Button } from '@/components/ui/button'

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function SetHistoryPanel() {
  const {
    setId,
    savedSets,
    isSaving,
    lastSavedAt,
    isReady,
    createNewSet,
    loadSavedSet,
    deleteSavedSet,
  } = useSetBuilder()

  const visibleSets = savedSets.filter(
    (set) => set.problemIds.length > 0 || set.id === setId,
  )

  if (!isReady) {
    return (
      <div className="border-b border-border/70 px-4 py-3 text-xs text-muted-foreground">
        Loading saved sets…
      </div>
    )
  }

  return (
    <div className="space-y-3 border-b border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">
            Saved sets
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Saved on this device · auto-updated when you edit
            {isSaving
              ? ' · saving…'
              : lastSavedAt
                ? ` · saved ${formatRelativeTime(lastSavedAt)}`
                : null}
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={createNewSet}>
          <Plus className="size-3.5" />
          New set
        </Button>
      </div>

      {visibleSets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 px-3 py-4 text-center text-xs text-muted-foreground">
          Click New set to create a draft. It saves to this browser right away.
        </p>
      ) : (
        <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-1">
          {visibleSets.map((set) => {
            const active = set.id === setId
            return (
              <li key={set.id}>
                <div
                  className={cn(
                    'group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
                    active
                      ? 'border-primary/30 bg-primary/5 shadow-sm'
                      : 'border-border/70 bg-background/80 hover:bg-muted/40',
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void loadSavedSet(set.id)}
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {set.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      {set.problemIds.length} problems ·{' '}
                      {formatRelativeTime(set.updatedAt)}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 opacity-60 group-hover:opacity-100"
                    aria-label={`Delete ${set.name}`}
                    onClick={() => void deleteSavedSet(set.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
