'use client'

import { memo } from 'react'
import { TutorMarkdown } from '@/lib/tutor-markdown'

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

  return <TutorMarkdown text={content} streaming={streaming} />
})
