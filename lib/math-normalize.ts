/**
 * Fix common PDF/Marker artifacts before KaTeX rendering.
 * Mirrors the highest-impact rules from src/math_normalize.py.
 */
const MATH_UNICODE: Array<[string, string]> = [
  ['μ', '\\mu'],
  ['µ', '\\mu'],
  ['η', '\\eta'],
  ['θ', '\\theta'],
  ['φ', '\\phi'],
  ['ω', '\\omega'],
  ['π', '\\pi'],
  ['ρ', '\\rho'],
  ['Δ', '\\Delta'],
  ['Ω', '\\Omega'],
  ['±', '\\pm'],
  ['×', '\\times'],
  ['·', '\\cdot'],
  ['≤', '\\leq'],
  ['≥', '\\geq'],
  ['∞', '\\infty'],
  ['→', '\\rightarrow'],
  ['²', '^{2}'],
  ['³', '^{3}'],
  ['₁', '_1'],
  ['₂', '_2'],
  ['₃', '_3'],
  ['ℎ', 'h'],
]

function mapUnicodeToLatex(value: string): string {
  let out = value
  for (const [uni, latex] of MATH_UNICODE) {
    out = out.split(uni).join(latex)
  }
  return out
}

function fixMathSegment(segment: string): string {
  let out = segment
  out = out.replace(/\x08oldsymbol\{/g, '\\boldsymbol{')
  out = out.replace(/\x08(?=[a-zA-Z])/g, '\\b')
  out = out.replace(/\x09ext\{/g, '\\text{')
  out = out.replace(/\\boldsymbol\{\\text\{([^}]*)\}\}/g, (_m, body: string) => {
    const inner = mapUnicodeToLatex(body.trim())
    return `\\boldsymbol{${inner}}`
  })
  return mapUnicodeToLatex(out)
}

export function normalizeMathSource(text: string): string {
  const parts: string[] = []
  const pattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(normalizePlainText(text.slice(last, match.index)))
    }
    parts.push(fixMathSegment(match[0]))
    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push(normalizePlainText(text.slice(last)))
  }

  return parts.join('')
}

function normalizePlainText(text: string): string {
  return text
    .replace(/\u2009/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/(?<!\$)μ(?!\w)/g, '$\\mu$')
    .replace(/(?<!\$)η(?!\w)/g, '$\\eta$')
    .replace(/(?<!\$)θ(?!\w)/g, '$\\theta$')
    .replace(/(?<!\$)ω(?!\w)/g, '$\\omega$')
}
