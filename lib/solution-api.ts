import { ADMIN_API_URL } from '@/lib/admin-api'
import { isAiTutorConfigured } from '@/lib/ai-tutor'

export interface SolutionHintsResponse {
  problem_id: string
  available: boolean
  total_hints: number
  hints: string[]
  full_markdown: string | null
}

export function isSolutionApiConfigured(): boolean {
  return isAiTutorConfigured() || ADMIN_API_URL.length > 0
}

function solutionUrl(problemId: string, params?: { through?: number; full?: boolean }): string {
  const sp = new URLSearchParams()
  if (params?.through !== undefined) sp.set('through', String(params.through))
  if (params?.full) sp.set('full', 'true')
  const qs = sp.toString()
  return `${ADMIN_API_URL}/api/problems/${encodeURIComponent(problemId)}/solution${qs ? `?${qs}` : ''}`
}

export async function fetchSolutionMeta(problemId: string): Promise<SolutionHintsResponse | null> {
  const res = await fetch(solutionUrl(problemId), { method: 'GET' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Solution fetch failed (${res.status})`)
  return res.json() as Promise<SolutionHintsResponse>
}

export async function fetchSolutionHints(
  problemId: string,
  through: number,
): Promise<SolutionHintsResponse> {
  const res = await fetch(solutionUrl(problemId, { through }), { method: 'GET' })
  if (!res.ok) throw new Error(`Solution hints failed (${res.status})`)
  return res.json() as Promise<SolutionHintsResponse>
}

export async function fetchFullSolution(problemId: string): Promise<SolutionHintsResponse> {
  const res = await fetch(solutionUrl(problemId, { full: true }), { method: 'GET' })
  if (!res.ok) throw new Error(`Full solution failed (${res.status})`)
  return res.json() as Promise<SolutionHintsResponse>
}

export interface SolutionsIndex {
  ids: string[]
}

export async function fetchSolutionsIndex(): Promise<Set<string>> {
  try {
    const res = await fetch('/data/solutions-index.json')
    if (!res.ok) return new Set()
    const data = (await res.json()) as SolutionsIndex
    return new Set(data.ids ?? [])
  } catch {
    return new Set()
  }
}
