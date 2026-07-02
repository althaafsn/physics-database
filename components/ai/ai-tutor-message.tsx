'use client'

import { memo } from 'react'
import { TutorMarkdown } from '@/lib/tutor-markdown'
import { cn } from '@/lib/utils'

export const AiTutorMessage = memo(function AiTutorMessage({
  content,
  streaming = false,
}: {
  content: string
  streaming?: boolean
}) {
  if (!content.trim()) {
    return null
  }

  return (
    <div className="relative">
      <TutorMarkdown text={content} streaming={streaming} />
      {streaming ? (
        <span
          className={cn(
            'ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-px animate-pulse',
            'bg-primary/70 align-middle',
          )}
          aria-hidden
        />
      ) : null}
    </div>
  )
})
