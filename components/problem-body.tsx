'use client'

import { MathText } from '@/components/math-text'

const IMAGE_RE = /!\[\]\(([^)]+)\)/g

export function ProblemBody({ text }: { text: string }) {
  const parts: Array<{ type: 'text' | 'image'; value: string }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = IMAGE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'image', value: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  if (parts.length === 0) {
    return <MathText>{text}</MathText>
  }

  return (
    <div className="space-y-3">
      {parts.map((part, index) =>
        part.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`img-${index}`}
            src={part.value}
            alt="Problem diagram"
            className="mx-auto max-h-[min(24rem,50vh)] max-w-full rounded-md border border-border object-contain"
          />
        ) : (
          <MathText key={`txt-${index}`}>{part.value.trim()}</MathText>
        ),
      )}
    </div>
  )
}
