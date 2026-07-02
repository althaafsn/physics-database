'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, RotateCcw, User } from 'lucide-react'
import { AiTutorMessage } from '@/components/ai/ai-tutor-message'
import { AiTutorProblemPanel } from '@/components/ai/ai-tutor-problem-panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  askTutorStream,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stickToBottomRef = useRef(true)
  const lastFailedPromptRef = useRef<string | null>(null)

  useEffect(() => {
    setMessages([])
    setError(null)
    setInput('')
    abortRef.current?.abort()
    stickToBottomRef.current = true
  }, [problem?.id])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      stickToBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 96
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!stickToBottomRef.current) return
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, pending])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [input])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || pending) return

    setError(null)
    lastFailedPromptRef.current = null
    const nextMessages: TutorMessage[] = [
      ...messages,
      { role: 'user', content },
    ]
    setMessages(nextMessages)
    setInput('')
    stickToBottomRef.current = true

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
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await askTutorStream({
        messages: nextMessages,
        problem: toTutorContext(problem),
        signal: controller.signal,
        onDelta: (_chunk, fullText) => {
          setMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last?.role !== 'assistant') return prev
            copy[copy.length - 1] = { role: 'assistant', content: fullText }
            return copy
          })
        },
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content.trim()) {
          return prev.slice(0, -1)
        }
        return prev
      })
      lastFailedPromptRef.current = content
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setPending(false)
    }
  }

  const resetChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setInput('')
    setPending(false)
    lastFailedPromptRef.current = null
    stickToBottomRef.current = true
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
  const showFollowUpPrompts =
    !isEmpty && !pending && !input.trim() && prompts.length > 0

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col bg-background/40',
        variant === 'page' ? 'h-full' : 'h-full',
        className,
      )}
    >
      {!configured ? (
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-pretty">
            Preview mode — connect an AI endpoint to get live tutoring answers.
          </span>
        </div>
      ) : null}

      {problem ? (
        <AiTutorProblemPanel problem={problem} variant={variant} />
      ) : null}

      <div
        ref={scrollRef}
        data-tutor-messages
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 sm:px-5"
        aria-live="polite"
        aria-busy={pending}
      >
        {isEmpty ? (
          <EmptyState problem={problem} configured={configured} />
        ) : (
          messages.map((message, index) => (
            <ChatBubble
              key={index}
              message={message}
              streaming={
                pending &&
                index === messages.length - 1 &&
                message.role === 'assistant'
              }
            />
          ))
        )}

        {error ? (
          <div className="flex flex-col gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span className="text-pretty">{error}</span>
            {lastFailedPromptRef.current ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => void send(lastFailedPromptRef.current!)}
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="space-y-2 border-t border-border/60 bg-muted/10 px-3 py-3 sm:px-5">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Suggested questions
          </p>
          <div className="flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <SuggestionChip
                key={prompt}
                label={prompt}
                onClick={() => void send(prompt)}
                disabled={pending}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showFollowUpPrompts ? (
        <div className="flex gap-2 overflow-x-auto border-t border-border/50 bg-muted/5 px-3 py-2 sm:px-5">
          {prompts.slice(0, 2).map((prompt) => (
            <SuggestionChip
              key={prompt}
              label={prompt}
              onClick={() => void send(prompt)}
              disabled={pending}
              compact
            />
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="shrink-0 border-t border-border/70 bg-card/70 p-3 backdrop-blur-sm sm:px-5"
      >
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                problem
                  ? 'Ask for a hint, concept, or next step…'
                  : 'Ask a physics question…'
              }
              disabled={pending}
              className="max-h-32 min-h-10 w-full resize-none rounded-xl border-0 bg-muted/50 px-3.5 py-2.5 text-sm text-foreground shadow-none ring-1 ring-border/60 placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:outline-none disabled:opacity-60"
            />
            <p className="mt-1.5 hidden text-[10px] text-muted-foreground sm:block">
              Enter to send · Shift+Enter for a new line
            </p>
          </div>
          {messages.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Start a new conversation"
              title="New conversation"
              onClick={resetChat}
            >
              <RotateCcw className="size-4" />
            </Button>
          ) : null}
          <Button
            type="submit"
            size="icon"
            className="shrink-0 rounded-xl"
            aria-label="Send message"
            disabled={!input.trim() || pending}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}

function EmptyState({
  problem,
  configured,
}: {
  problem?: Problem | null
  configured: boolean
}) {
  return (
    <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-3 py-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
        <Sparkles className="size-5" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          {problem ? 'Ready when you are' : 'Your physics study partner'}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {problem
            ? 'Read the problem above, then ask for a hint or pick a suggested question below.'
            : configured
              ? 'Ask about concepts, strategies, or pick a problem from the sidebar for targeted help.'
              : 'Try the chat UI now — live AI answers activate once an endpoint is connected.'}
        </p>
      </div>
    </div>
  )
}

function SuggestionChip({
  label,
  onClick,
  disabled,
  compact = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border border-border/70 bg-background text-left text-muted-foreground transition-colors',
        'hover:border-primary/35 hover:bg-primary/5 hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        compact
          ? 'shrink-0 px-2.5 py-1 text-[10px]'
          : 'px-3 py-1.5 text-xs',
      )}
    >
      {label}
    </button>
  )
}

function ChatBubble({
  message,
  streaming = false,
}: {
  message: TutorMessage
  streaming?: boolean
}) {
  const isUser = message.role === 'user'
  const isThinking = !isUser && streaming && !message.content.trim()

  return (
    <div
      className={cn(
        'flex gap-2.5',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1',
          isUser
            ? 'bg-primary text-primary-foreground ring-primary/20'
            : 'bg-primary/10 text-primary ring-primary/15',
        )}
        aria-hidden
      >
        {isUser ? (
          <User className="size-3.5" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
      </div>

      <div
        className={cn(
          'min-w-0 max-w-[min(82%,40rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'rounded-tr-md bg-primary text-primary-foreground'
            : 'rounded-tl-md border border-border/60 bg-card text-foreground/90',
        )}
      >
        {isThinking ? (
          <TypingIndicator />
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <AiTutorMessage content={message.content} streaming={streaming} />
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Tutor is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  )
}
