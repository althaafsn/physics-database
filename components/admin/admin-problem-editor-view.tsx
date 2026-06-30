'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bold,
  Italic,
  Sigma,
  SquareRadical,
  Superscript,
  Subscript,
  Divide,
  Save,
  Eye,
  CircleCheck,
  CircleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  adminGetProblem,
  adminUpdateProblem,
  type AdminProblemDetail,
} from '@/lib/admin-api'
import { getAdminToken } from '@/lib/admin-auth'
import { useRequireAdminAuth } from '@/components/admin/use-admin-auth'
import { MathText } from '@/components/math-text'
import { QualityBadge, LevelBadge } from '@/components/status-badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GOLD_TOPIC_LABELS, GOLD_TOPICS } from '@/lib/types'
import { cn } from '@/lib/utils'

type BodyField = 'id' | 'en'

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>
  label: string
  before: string
  after: string
  placeholder: string
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { icon: Bold, label: 'Bold', before: '**', after: '**', placeholder: 'bold' },
  { icon: Italic, label: 'Italic', before: '*', after: '*', placeholder: 'italic' },
  { icon: Sigma, label: 'Inline math', before: '$', after: '$', placeholder: 'x' },
  { icon: SquareRadical, label: 'Square root', before: '$\\sqrt{', after: '}$', placeholder: 'x' },
  { icon: Divide, label: 'Fraction', before: '$\\frac{', after: '}{}$', placeholder: 'a' },
  { icon: Superscript, label: 'Power', before: '$', after: '^{2}$', placeholder: 'x' },
  { icon: Subscript, label: 'Subscript', before: '$', after: '_{0}$', placeholder: 'x' },
]

const SYMBOLS = ['\\times', '\\cdot', '\\pm', '\\Delta', '\\theta', '\\pi', '\\omega', '\\degree']

function countWords(text: string) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function AdminProblemEditorView({ problemId }: { problemId: string }) {
  const { loading } = useRequireAdminAuth({ requireSubscription: true })
  const [problem, setProblem] = useState<AdminProblemDetail | null>(null)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [bodyMdEn, setBodyMdEn] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeBody, setActiveBody] = useState<BodyField>('id')
  const [previewLang, setPreviewLang] = useState<BodyField>('id')

  const idBodyRef = useRef<HTMLTextAreaElement>(null)
  const enBodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const token = getAdminToken()
    if (!token || loading) return
    adminGetProblem(token, problemId)
      .then((p) => {
        setProblem(p)
        setTitle(p.title)
        setTopic(p.topic)
        setBodyMd(p.body_md)
        setTitleEn(p.title_en ?? '')
        setBodyMdEn(p.body_md_en ?? '')
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load'))
  }, [problemId, loading])

  const isDirty = useMemo(() => {
    if (!problem) return false
    return (
      title !== problem.title ||
      topic !== problem.topic ||
      bodyMd !== problem.body_md ||
      titleEn !== (problem.title_en ?? '') ||
      bodyMdEn !== (problem.body_md_en ?? '')
    )
  }, [problem, title, topic, bodyMd, titleEn, bodyMdEn])

  const save = useCallback(async () => {
    const token = getAdminToken()
    if (!token || !isDirty) return
    setSaving(true)
    try {
      const updated = await adminUpdateProblem(token, problemId, {
        title,
        topic,
        body_md: bodyMd,
        title_en: titleEn || null,
        body_md_en: bodyMdEn || null,
      })
      setProblem(updated)
      toast.success('Saved — catalog re-synced')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [isDirty, problemId, title, topic, bodyMd, titleEn, bodyMdEn])

  // Cmd/Ctrl+S to save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const insert = useCallback(
    (before: string, after: string, placeholder: string) => {
      const field = activeBody
      const ref = field === 'id' ? idBodyRef : enBodyRef
      const el = ref.current
      const value = field === 'id' ? bodyMd : bodyMdEn
      const setValue = field === 'id' ? setBodyMd : setBodyMdEn
      const start = el?.selectionStart ?? value.length
      const end = el?.selectionEnd ?? value.length
      const selected = value.slice(start, end) || placeholder
      const next = value.slice(0, start) + before + selected + after + value.slice(end)
      setValue(next)
      requestAnimationFrame(() => {
        el?.focus()
        const cursor = start + before.length
        el?.setSelectionRange(cursor, cursor + selected.length)
      })
    },
    [activeBody, bodyMd, bodyMdEn],
  )

  if (loading || !problem) {
    return <EditorSkeleton />
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Sticky header bar */}
      <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-2 border-b border-border/80 bg-card/80 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/admin/problems"
              className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to all problems
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-base font-semibold text-foreground">
                {problemId}
              </h1>
              <LevelBadge level={`${problem.level} ${problem.year}`} />
              {problem.catalog_eligible ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-quality-clean/20 px-2 py-0.5 text-[11px] font-medium text-quality-clean-foreground">
                  <CircleCheck className="size-3" />
                  On public catalog
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-quality-error/15 px-2 py-0.5 text-[11px] font-medium text-quality-error-foreground">
                  <CircleAlert className="size-3" />
                  Hidden from catalog
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-xs font-medium transition-opacity',
                isDirty ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
              )}
            >
              {isDirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <Button onClick={save} disabled={saving || !isDirty}>
              <Save className="size-4" />
              {saving ? 'Saving…' : 'Save'}
              <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1 text-[10px] font-medium opacity-70 sm:inline">
                ⌘S
              </kbd>
            </Button>
          </div>
        </div>
      </div>

      {problem.errors.length > 0 && (
        <div className="rounded-xl border border-quality-error/40 bg-quality-error/5 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-quality-error-foreground">
            <CircleAlert className="size-4" />
            {problem.errors.length} validation{' '}
            {problem.errors.length === 1 ? 'issue' : 'issues'} to resolve
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {problem.errors.map((e) => (
              <li key={e.code}>
                <span className="font-mono text-xs">{e.code}</span> — {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor column */}
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title (Indonesian)</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Select value={topic} onValueChange={(v) => v && setTopic(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOLD_TOPICS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {GOLD_TOPIC_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title-en">Title (English)</Label>
              <Input
                id="title-en"
                value={titleEn}
                placeholder="Optional translation"
                onChange={(e) => setTitleEn(e.target.value)}
              />
            </div>
          </div>

          {/* Body editor with toolbar + language tabs */}
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card/50">
            <div className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/30 px-2 py-1.5">
              {TOOLBAR_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title={action.label}
                  aria-label={action.label}
                  onClick={() => insert(action.before, action.after, action.placeholder)}
                >
                  <action.icon className="size-3.5" />
                </Button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
              {SYMBOLS.map((sym) => (
                <Button
                  key={sym}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="font-mono"
                  title={`Insert ${sym}`}
                  aria-label={`Insert ${sym}`}
                  onClick={() => insert(`$${sym}$`, '', '')}
                >
                  <MathText className="text-xs">{`$${sym}$`}</MathText>
                </Button>
              ))}
            </div>

            <Tabs
              value={activeBody}
              onValueChange={(v) => setActiveBody((v as BodyField) ?? 'id')}
              className="gap-0"
            >
              <div className="flex items-center justify-between border-b border-border/70 px-3 pt-2">
                <TabsList variant="line">
                  <TabsTrigger value="id">Indonesian</TabsTrigger>
                  <TabsTrigger value="en">English</TabsTrigger>
                </TabsList>
                <span className="pb-2 text-[11px] tabular-nums text-muted-foreground">
                  {countWords(activeBody === 'id' ? bodyMd : bodyMdEn)} words
                </span>
              </div>
              <TabsContent value="id">
                <Textarea
                  ref={idBodyRef}
                  className="min-h-[340px] resize-y rounded-none border-0 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
                  value={bodyMd}
                  onFocus={() => setActiveBody('id')}
                  onChange={(e) => setBodyMd(e.target.value)}
                  placeholder="Markdown body with $inline$ and $$display$$ LaTeX…"
                />
              </TabsContent>
              <TabsContent value="en">
                <Textarea
                  ref={enBodyRef}
                  className="min-h-[340px] resize-y rounded-none border-0 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
                  value={bodyMdEn}
                  onFocus={() => setActiveBody('en')}
                  onChange={(e) => setBodyMdEn(e.target.value)}
                  placeholder="Optional English translation…"
                />
              </TabsContent>
            </Tabs>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: select text and click a toolbar button to wrap it. Use{' '}
            <kbd className="rounded border border-border bg-muted px-1 text-[10px]">⌘S</kbd>{' '}
            to save.
          </p>
        </div>

        {/* Preview column */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="size-3.5" />
              Live preview
            </Label>
            <Tabs
              value={previewLang}
              onValueChange={(v) => setPreviewLang((v as BodyField) ?? 'id')}
            >
              <TabsList className="h-7">
                <TabsTrigger value="id" className="text-xs">
                  ID
                </TabsTrigger>
                <TabsTrigger value="en" className="text-xs">
                  EN
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
            {(() => {
              const showTitle = previewLang === 'en' ? titleEn || title : title
              const showBody = previewLang === 'en' ? bodyMdEn : bodyMd
              if (!showBody.trim()) {
                return (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {previewLang === 'en'
                      ? 'No English translation yet.'
                      : 'Start typing to see a live preview.'}
                  </p>
                )
              }
              return (
                <>
                  <h3 className="mb-4 text-lg font-semibold leading-snug text-foreground text-pretty">
                    <MathText>{showTitle}</MathText>
                  </h3>
                  <MathText className="block text-sm leading-relaxed text-foreground/90">
                    {showBody}
                  </MathText>
                </>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/50" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-10 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-10 w-1/2 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-80 animate-pulse rounded-xl bg-muted/30" />
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-muted/30" />
      </div>
    </div>
  )
}
