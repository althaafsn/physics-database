export const ADMIN_API_URL =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:8000'

export interface AdminUser {
  id: number
  email: string
  subscription_status: string
  subscription_expires_at: string | null
  has_active_subscription: boolean
}

export interface AdminProblemSummary {
  id: string
  title: string
  level: string | null
  year: number | null
  topic: string
  topic_confidence: number
  error_count: number
  catalog_eligible: boolean
  llm_repaired: boolean
}

export interface AdminProblemDetail {
  id: string
  document_slug: string
  level: string | null
  year: number | null
  title: string
  topic: string
  topic_confidence: number
  body_md: string
  title_en: string | null
  body_md_en: string | null
  subparts: { label: string; text: string }[]
  subparts_en: { label: string; text: string }[]
  errors: { code: string; message: string; snippet?: string }[]
  catalog_eligible: boolean
  flags: string[]
  images: { filename: string; path: string }[]
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return typeof data.detail === 'string' ? data.detail : res.statusText
  } catch {
    return res.statusText
  }
}

export async function adminRegister(email: string, password: string) {
  const res = await fetch(`${ADMIN_API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ access_token: string }>
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${ADMIN_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ access_token: string }>
}

export async function adminMe(token: string) {
  const res = await fetch(`${ADMIN_API_URL}/api/auth/me`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<AdminUser>
}

export async function adminSubscribe(token: string, plan: 'monthly' | 'yearly' = 'monthly') {
  const res = await fetch(`${ADMIN_API_URL}/api/billing/subscribe`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ plan }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function adminListProblems(
  token: string,
  params: { q?: string; level?: string; errors_only?: boolean } = {},
) {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.level) sp.set('level', params.level)
  if (params.errors_only) sp.set('errors_only', 'true')
  const res = await fetch(`${ADMIN_API_URL}/api/problems?${sp}`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ total: number; problems: AdminProblemSummary[] }>
}

export async function adminGetProblem(token: string, id: string) {
  const res = await fetch(`${ADMIN_API_URL}/api/problems/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<AdminProblemDetail>
}

export async function adminUpdateProblem(
  token: string,
  id: string,
  body: Partial<
    Pick<AdminProblemDetail, 'title' | 'topic' | 'body_md' | 'title_en' | 'body_md_en'>
  >,
) {
  const res = await fetch(`${ADMIN_API_URL}/api/problems/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<AdminProblemDetail>
}

export async function adminPublish(token: string) {
  const res = await fetch(`${ADMIN_API_URL}/api/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
