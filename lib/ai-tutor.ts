import type { Problem } from '@/lib/types'

/**
 * AI Tutor client.
 *
 * This app is a fully static export (`output: 'export'`), so there is no
 * server/API route to run a model. To enable real AI answers, host a small
 * endpoint (any provider/runtime) that accepts the request body below and
 * returns `{ reply: string }`, then set its URL in the environment variable
 * `NEXT_PUBLIC_AI_TUTOR_ENDPOINT` at build time.
 *
 * === INTEGRATION POINT ===
 * Expected request  (POST, application/json):
 *   {
 *     "messages": [{ "role": "user" | "assistant", "content": string }, ...],
 *     "problem":  { "id", "title", "body", "parts" } | null
 *   }
 * Expected response (application/json, non-streaming fallback):
 *   { "reply": string }   // markdown + $$LaTeX$$ is supported by the UI
 *
 * Streaming (preferred): POST to `{endpoint}/stream` with the same body.
 * Server-Sent Events, one JSON object per `data:` line:
 *   { "delta": string }   token chunks as they arrive
 *   { "done": true }      stream finished
 *   { "error": string }   optional provider failure
 *
 * Until the endpoint is configured, the UI runs in an honest "preview" mode:
 * the full chat experience works, but sends return a clearly-labeled notice
 * instead of a fabricated answer.
 */

export interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TutorProblemContext {
  id: string
  title: string
  body: string
  parts?: { label: string; prompt: string }[]
}

export const AI_TUTOR_ENDPOINT = (
  process.env.NEXT_PUBLIC_AI_TUTOR_ENDPOINT ?? ''
).trim()

export function isAiTutorConfigured(): boolean {
  return AI_TUTOR_ENDPOINT.length > 0
}

export function tutorStreamEndpoint(): string {
  const base = AI_TUTOR_ENDPOINT.replace(/\/$/, '')
  return `${base}/stream`
}

type TutorStreamEvent =
  | { delta?: string; done?: boolean; error?: string }
  | Record<string, unknown>

async function* readSseJson(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<TutorStreamEvent> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          yield JSON.parse(line.slice(6)) as TutorStreamEvent
        } catch {
          // ignore malformed frames
        }
      }
    }
  }
}

export class AiTutorNotConfiguredError extends Error {
  constructor() {
    super('AI tutor endpoint is not configured')
    this.name = 'AiTutorNotConfiguredError'
  }
}

export function toTutorContext(problem: Problem | null | undefined): TutorProblemContext | null {
  if (!problem) return null
  return {
    id: problem.id,
    title: problem.title,
    body: problem.body,
    parts: problem.parts?.map((p) => ({ label: p.label, prompt: p.prompt })),
  }
}

function tutorRequestBody(opts: {
  messages: TutorMessage[]
  problem?: TutorProblemContext | null
}) {
  return JSON.stringify({
    messages: opts.messages,
    problem: opts.problem ?? null,
  })
}

/** Stream tokens as they arrive; returns the full assembled reply. */
export async function askTutorStream(opts: {
  messages: TutorMessage[]
  problem?: TutorProblemContext | null
  signal?: AbortSignal
  onDelta?: (chunk: string, fullText: string) => void
}): Promise<string> {
  if (!isAiTutorConfigured()) {
    throw new AiTutorNotConfiguredError()
  }

  const res = await fetch(tutorStreamEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: tutorRequestBody(opts),
    signal: opts.signal,
  })

  if (!res.ok) {
    throw new Error(`AI request failed (${res.status})`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('The AI service returned an unexpected response.')
  }

  let fullText = ''
  let sawDone = false

  try {
    for await (const event of readSseJson(reader)) {
      if (typeof event.error === 'string' && event.error.trim()) {
        throw new Error(event.error)
      }
      if (typeof event.delta === 'string' && event.delta.length > 0) {
        fullText += event.delta
        opts.onDelta?.(event.delta, fullText)
      }
      if (event.done === true) {
        sawDone = true
        break
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!sawDone || fullText.trim().length === 0) {
    throw new Error('The AI service returned an unexpected response.')
  }
  return fullText
}

/** Non-streaming fallback (used by verify scripts and legacy callers). */
export async function askTutor(opts: {
  messages: TutorMessage[]
  problem?: TutorProblemContext | null
  signal?: AbortSignal
}): Promise<string> {
  if (!isAiTutorConfigured()) {
    throw new AiTutorNotConfiguredError()
  }

  const res = await fetch(AI_TUTOR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: tutorRequestBody(opts),
    signal: opts.signal,
  })

  if (!res.ok) {
    throw new Error(`AI request failed (${res.status})`)
  }

  const data = (await res.json()) as {
    reply?: unknown
    content?: unknown
    message?: unknown
  }
  const reply = data.reply ?? data.content ?? data.message
  if (typeof reply !== 'string' || reply.trim().length === 0) {
    throw new Error('The AI service returned an unexpected response.')
  }
  return reply
}

/** Contextual starter prompts shown as one-tap chips. */
export function suggestedPrompts(problem?: { title?: string } | null): string[] {
  if (problem) {
    return [
      'Give me a hint to get started',
      'Which physics concepts does this test?',
      'Walk me through the solution step by step',
      'Suggest a similar problem to practice',
    ]
  }
  return [
    'Explain the work-energy theorem with an example',
    'How do I approach projectile motion problems?',
    'What is the difference between OSK, OSP, and OSN?',
    'Give me a study plan for mechanics',
  ]
}

/** The honest preview reply used when no AI endpoint is configured. */
export function previewReply(problem?: { id?: string } | null): string {
  return [
    "**AI answers aren't connected in this deployment yet.**",
    '',
    problem?.id
      ? `Once an AI endpoint is configured, you'll get step-by-step help grounded in problem **${problem.id}** right here — hints, concept explanations, and worked reasoning.`
      : "Once an AI endpoint is configured, you'll get step-by-step physics help, concept explanations, and study guidance right here.",
    '',
    'This is a fully working preview of the experience — the chat, context, and controls all behave exactly as they will with a live model.',
  ].join('\n')
}
