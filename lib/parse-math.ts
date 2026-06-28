import { normalizeMathSource } from '@/lib/math-normalize'

export type MathSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean }

/**
 * Split plain text into text and LaTeX segments ($...$ inline, $$...$$ display).
 */
export function parseMathSegments(input: string): MathSegment[] {
  const text = normalizeMathSource(input ?? '')
  const segments: MathSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    if (text.startsWith('$$', cursor)) {
      const end = text.indexOf('$$', cursor + 2)
      if (end !== -1) {
        segments.push({
          kind: 'math',
          value: text.slice(cursor + 2, end).trim(),
          display: true,
        })
        cursor = end + 2
        continue
      }
    }

    if (text[cursor] === '$' && text[cursor + 1] !== '$') {
      const end = text.indexOf('$', cursor + 1)
      if (end !== -1) {
        segments.push({
          kind: 'math',
          value: text.slice(cursor + 1, end).trim(),
          display: false,
        })
        cursor = end + 1
        continue
      }
    }

    let next = text.length
    const displayIdx = text.indexOf('$$', cursor)
    const inlineIdx = text.indexOf('$', cursor)
    if (displayIdx !== -1) next = Math.min(next, displayIdx)
    if (inlineIdx !== -1) next = Math.min(next, inlineIdx)

    const chunk = text.slice(cursor, next)
    if (chunk) {
      segments.push({ kind: 'text', value: chunk })
    }
    cursor = next === cursor ? cursor + 1 : next
  }

  return segments
}
