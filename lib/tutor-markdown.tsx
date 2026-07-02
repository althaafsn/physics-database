import { Fragment, type ReactNode } from 'react'
import { MathText } from '@/components/math-text'
import { parseMathSegments } from '@/lib/parse-math'
import { cn } from '@/lib/utils'

const UNORDERED_ITEM_RE = /^[-*+]\s+/
const ORDERED_ITEM_RE = /^\d+\.\s+/
const HEADING_RE = /^(#{1,4})\s+(.+)$/
const BLOCKQUOTE_RE = /^>\s?/

/** Close dangling math delimiters so KaTeX can render partial stream output. */
export function stabilizeStreamingText(text: string): string {
  if (!text) return text
  let out = text
  const displayDelims = out.match(/\$\$/g)?.length ?? 0
  if (displayDelims % 2 === 1) out += '$$'
  const withoutDisplay = out.replace(/\$\$[\s\S]*?\$\$/g, '')
  const inlineDelims = withoutDisplay.match(/(?<!\$)\$(?!\$)/g)?.length ?? 0
  if (inlineDelims % 2 === 1) out += '$'
  return out
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'blockquote'; lines: string[] }

function splitBlocks(source: string): Block[] {
  const chunks = source.replace(/\r\n/g, '\n').split(/\n{2,}/)
  const blocks: Block[] = []

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed) continue

    const lines = trimmed.split('\n')
    const headingMatch = trimmed.match(HEADING_RE)
    if (headingMatch && !trimmed.includes('\n')) {
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      })
      continue
    }

    if (lines.every((line) => BLOCKQUOTE_RE.test(line))) {
      blocks.push({
        kind: 'blockquote',
        lines: lines.map((line) => line.replace(BLOCKQUOTE_RE, '')),
      })
      continue
    }

    if (lines.length > 1 && lines.every((line) => UNORDERED_ITEM_RE.test(line))) {
      blocks.push({
        kind: 'ul',
        items: lines.map((line) => line.replace(UNORDERED_ITEM_RE, '')),
      })
      continue
    }

    if (lines.length > 1 && lines.every((line) => ORDERED_ITEM_RE.test(line))) {
      blocks.push({
        kind: 'ol',
        items: lines.map((line) => line.replace(ORDERED_ITEM_RE, '')),
      })
      continue
    }

    blocks.push({ kind: 'paragraph', lines })
  }

  return blocks
}

const INLINE_RE =
  /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`|\[[^\]]+\]\([^)\s]+\))/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const mathSegments = parseMathSegments(text)
  const nodes: ReactNode[] = []

  mathSegments.forEach((segment, segmentIndex) => {
    const segmentKey = `${keyPrefix}-m${segmentIndex}`

    if (segment.kind === 'math') {
      const wrapped = segment.display
        ? `$$${segment.value}$$`
        : `$${segment.value}$`
      nodes.push(<MathText key={segmentKey}>{wrapped}</MathText>)
      return
    }

    let last = 0
    let match: RegExpExecArray | null
    const value = segment.value

    while ((match = INLINE_RE.exec(value)) !== null) {
      if (match.index > last) {
        nodes.push(
          <Fragment key={`${segmentKey}-t${last}`}>
            {value.slice(last, match.index)}
          </Fragment>,
        )
      }

      const token = match[0]
      const tokenKey = `${segmentKey}-i${match.index}`

      if (token.startsWith('**')) {
        nodes.push(
          <strong key={tokenKey} className="font-semibold text-foreground">
            {token.slice(2, -2)}
          </strong>,
        )
      } else if (token.startsWith('*')) {
        nodes.push(
          <em key={tokenKey} className="italic">
            {token.slice(1, -1)}
          </em>,
        )
      } else if (token.startsWith('`')) {
        nodes.push(
          <code
            key={tokenKey}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {token.slice(1, -1)}
          </code>,
        )
      } else if (token.startsWith('[')) {
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (linkMatch) {
          nodes.push(
            <a
              key={tokenKey}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {linkMatch[1]}
            </a>,
          )
        } else {
          nodes.push(<Fragment key={tokenKey}>{token}</Fragment>)
        }
      }

      last = match.index + token.length
    }

    if (last < value.length) {
      nodes.push(
        <Fragment key={`${segmentKey}-tail`}>{value.slice(last)}</Fragment>,
      )
    }
  })

  return nodes
}

function renderParagraphLines(lines: string[], keyPrefix: string) {
  return lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-line-${index}`}>
      {index > 0 ? <br /> : null}
      {renderInline(line, `${keyPrefix}-line-${index}`)}
    </Fragment>
  ))
}

export function TutorMarkdown({
  text,
  streaming = false,
  className,
}: {
  text: string
  streaming?: boolean
  className?: string
}) {
  const source = streaming ? stabilizeStreamingText(text) : text
  const blocks = splitBlocks(source)

  if (blocks.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'tutor-markdown space-y-2.5 text-sm leading-relaxed text-foreground/90',
        '[&_.katex]:text-foreground [&_.katex-display]:my-2',
        className,
      )}
    >
      {blocks.map((block, index) => {
        const key = `block-${index}`

        if (block.kind === 'heading') {
          const Tag = (
            block.level <= 2 ? 'h3' : block.level === 3 ? 'h4' : 'h5'
          ) as 'h3' | 'h4' | 'h5'
          return (
            <Tag
              key={key}
              className={cn(
                'font-semibold tracking-tight text-foreground',
                block.level <= 2 ? 'text-base' : 'text-sm',
              )}
            >
              {renderInline(block.text, key)}
            </Tag>
          )
        }

        if (block.kind === 'ul') {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-item-${itemIndex}`} className="text-pretty">
                  {renderInline(item, `${key}-item-${itemIndex}`)}
                </li>
              ))}
            </ul>
          )
        }

        if (block.kind === 'ol') {
          return (
            <ol
              key={key}
              className="list-decimal space-y-1 pl-5 marker:font-medium marker:text-muted-foreground"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-item-${itemIndex}`} className="text-pretty">
                  {renderInline(item, `${key}-item-${itemIndex}`)}
                </li>
              ))}
            </ol>
          )
        }

        if (block.kind === 'blockquote') {
          return (
            <blockquote
              key={key}
              className="border-l-2 border-primary/30 pl-3 text-muted-foreground"
            >
              {renderParagraphLines(block.lines, key)}
            </blockquote>
          )
        }

        return (
          <p key={key} className="text-pretty">
            {renderParagraphLines(block.lines, key)}
          </p>
        )
      })}
    </div>
  )
}
