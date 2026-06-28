import type { Problem } from './types'

/**
 * Compiles an ordered list of problems into exam Markdown output.
 */
export function compileSetMarkdown(name: string, problems: Problem[]): string {
  const lines: string[] = [`# ${name}`, '']

  problems.forEach((p, idx) => {
    lines.push(`## ${idx + 1}. ${p.title}`)
    lines.push(`_${p.level} · ${p.year} · ${p.topic} · \`${p.id}\`_`)
    lines.push('')
    lines.push(p.body)
    lines.push('')
    for (const part of p.parts) {
      lines.push(`(${part.label}) ${part.prompt}`)
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  })

  if (lines.length >= 2 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  if (lines.length >= 1 && lines[lines.length - 1] === '---') {
    lines.pop()
  }

  return lines.join('\n').trimEnd() + '\n'
}
