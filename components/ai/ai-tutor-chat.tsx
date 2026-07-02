'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, RotateCcw, Loader2 } from 'lucide-react'
import { ProblemBody } from '@/components/problem-body'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  askTutor,
  isAiTutorConfigured,
  previewReply,
  suggestedPrompts,
  toTutorContext,
  type TutorMessage,
} from '@/lib/ai-tutor'
import type { Problem } from '@/lib/types'

interface AiTutorChatProps {
  problem?: Problem | null
  variant?: 'embedded' | 'page'
  className?: string
}

export function AiTutorChat({
  problem,
  variant = 'embedded',
  className,
}: AiTutorChatProps) {
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configured = isAiTutorConfigured()

  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Reset the conversation whenever the grounding problem changes.
  useEffect(() => {
    setMessages([])
    setError(null)
    abortRef.current?.abort()
  }, [problem?.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, pending])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || pending) return

    setError(null)
    const nextMessages: TutorMessage[] = [
      ...messages,
      { role: 'user', content },
    ]
    setMessages(nextMessages)
    setInput('')

    // Preview mode: honest, clearly-labeled response (no fabricated physics).
    if (!configured) {
      setPending(true)
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: previewReply(problem) },
        ])
        setPending(false)
      }, 450)
      return
    }

    setPending(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const reply = await askTutor({
        messages: nextMessages,
        problem: toTutorContext(problem),
        signal: controller.signal,
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setPending(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Respect IME composition (CJK) and Shift+Enter for newlines.
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault()
      void send(input)
    }
  }

  const prompts = suggestedPrompts(problem)
  const isEmpty = messages.length === 0

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        variant === 'page' ? 'h-full' : 'h-full',
        className,
      )}
    >
      {!configured ? (
        <div className="flex items-center gap-2 border-b border-primary/15 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0 text-primary" />
          <span className="text-pretty">
            Preview mode — AI answers activate once an endpoint is connected.
          </span>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4"
        aria-live="polite"
        aria-busy={pending}
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-6 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {problem
                  ? `Ask about ${problem.id}`
                  : 'Ask the physics tutor anything'}
              </p>
              <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground text-pretty">
                {problem
                  ? 'Get hints, concept breakdowns, and step-by-step guidance for this problem.'
                  : 'Concepts, problem-solving strategies, and study help for the olympiad corpus.'}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatBubble key={index} message={message} />
          ))
        )}

        {pending ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Thinking…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-3 py-2.5 sm:px-4">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void send(prompt)}
              className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="flex items-end gap-2 border-t border-border/70 bg-card/40 p-3 backdrop-blur-sm"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={
            problem ? 'Ask about this problem…' : 'Ask a physics question…'
          }
          className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border-0 bg-muted/40 px-3 py-2 text-sm text-foreground shadow-none ring-1 ring-border/60 placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        />
        {messages.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Start a new conversation"
            onClick={() => {
              abortRef.current?.abort()
              setMessages([])
              setError(null)
              setPending(false)
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
        ) : null}
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={!input.trim() || pending}
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}

function ChatBubble({ message }: { message: TutorMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm border border-border/70 bg-card text-foreground/90',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-sm max-w-none [&_.katex]:text-foreground">
            <ProblemBody text={message.content} />
          </div>
        )}
      </div>
    </div>
  )
}
