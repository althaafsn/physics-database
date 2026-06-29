'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'sonner'
import { adminGetProblem, adminUpdateProblem, type AdminProblemDetail } from '@/lib/admin-api'
import { getAdminToken } from '@/lib/admin-auth'
import { useRequireAdminAuth } from '@/components/admin/use-admin-auth'
import { MathText } from '@/components/math-text'
import { QualityBadge } from '@/components/status-badges'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TOPICS = [
  'mechanics',
  'electromagnetism',
  'thermodynamics',
  'waves_optics',
  'modern_physics',
  'mixed',
]

export function AdminProblemEditorView({ problemId }: { problemId: string }) {
  const { loading } = useRequireAdminAuth({ requireSubscription: true })
  const [problem, setProblem] = useState<AdminProblemDetail | null>(null)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [bodyMdEn, setBodyMdEn] = useState('')
  const [saving, setSaving] = useState(false)

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

  async function save() {
    const token = getAdminToken()
    if (!token) return
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
  }

  if (loading || !problem) {
    return <p className="text-muted-foreground">Loading problem…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/problems"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to list
          </Link>
          <h1 className="font-mono text-lg">{problemId}</h1>
          <p className="text-sm text-muted-foreground">
            {problem.level} {problem.year} · confidence {problem.topic_confidence.toFixed(2)}
            {problem.catalog_eligible ? (
              <span className="ml-2 text-quality-clean-foreground">on public catalog</span>
            ) : (
              <span className="ml-2 text-quality-error-foreground">hidden from catalog</span>
            )}
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="size-4" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {problem.errors.length > 0 && (
        <Card className="border-quality-error/40 bg-quality-error/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QualityBadge quality="error" />
              Validation errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {problem.errors.map((e) => (
                <li key={e.code}>
                  <span className="font-mono text-xs">{e.code}</span> — {e.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Topic</Label>
            <Select value={topic} onValueChange={(v) => v && setTopic(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPICS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body (markdown + $LaTeX$)</Label>
            <Textarea
              id="body"
              className="min-h-[280px] font-mono text-xs"
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title-en">Title (EN)</Label>
            <Input id="title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body-en">Body (EN)</Label>
            <Textarea
              id="body-en"
              className="min-h-[120px] font-mono text-xs"
              value={bodyMdEn}
              onChange={(e) => setBodyMdEn(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="rounded-xl border border-border/80 bg-card/50 p-5">
            <h3 className="mb-3 font-semibold">
              <MathText>{title}</MathText>
            </h3>
            <MathText className="text-sm leading-relaxed text-foreground/90">{bodyMd}</MathText>
          </div>
        </div>
      </div>
    </div>
  )
}
