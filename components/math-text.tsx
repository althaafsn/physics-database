'use client'

import katex from 'katex'
import { useMemo } from 'react'
import { parseMathSegments } from '@/lib/parse-math'
import { cn } from '@/lib/utils'

interface MathTextProps {
  children: string
  className?: string
  /** When true, a segment that is the entire string renders as display math */
  block?: boolean
}

function renderSegment(tex: string, displayMode: boolean) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: true,
      output: 'html',
    })
  } catch {
    return escapeHtml(tex)
  }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Renders Indonesian problem text with inline ($...$) and display ($$...$$) LaTeX.
 */
export function MathText({ children, className, block }: MathTextProps) {
  const html = useMemo(() => {
    const segments = parseMathSegments(children ?? '')
    const onlyDisplayMath =
      segments.length === 1 &&
      segments[0].kind === 'math' &&
      segments[0].display

    return segments
      .map((segment) => {
        if (segment.kind === 'math') {
          const display = segment.display || (Boolean(block) && onlyDisplayMath)
          const rendered = renderSegment(segment.value, display)
          return display
            ? `<span class="math-display my-2 block text-center">${rendered}</span>`
            : rendered
        }
        return escapeHtml(segment.value)
      })
      .join('')
  }, [children, block])

  return (
    <span
      className={cn('leading-relaxed [&_.katex-display]:my-2', className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
