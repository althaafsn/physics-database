'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { adminListProblems, adminPublish, type AdminProblemSummary } from '@/lib/admin-api'
import { getAdminToken } from '@/lib/admin-auth'
import { useRequireAdminAuth } from '@/components/admin/use-admin-auth'
import { LevelBadge, QualityBadge, SolutionStatusBadge } from '@/components/status-badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GOLD_TOPIC_LABELS } from '@/lib/types'

export function AdminProblemsView() {
  const { loading } = useRequireAdminAuth({ requireSubscription: true })
  const [problems, setProblems] = useState<AdminProblemSummary[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('all')
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [solutionStatus, setSolutionStatus] = useState<'all' | 'none' | 'needs_review' | 'verified'>('all')
  const [fetching, setFetching] = useState(false)

  const load = useCallback(async () => {
    const token = getAdminToken()
    if (!token) return
    setFetching(true)
    try {
      const data = await adminListProblems(token, {
        q: q || undefined,
        level: level !== 'all' ? level : undefined,
        errors_only: errorsOnly,
        solution_status: solutionStatus !== 'all' ? solutionStatus : undefined,
      })
      setProblems(data.problems)
      setTotal(data.total)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load problems')
    } finally {
      setFetching(false)
    }
  }, [q, level, errorsOnly, solutionStatus])

  useEffect(() => {
    if (!loading) load()
  }, [loading, load])

  async function publish() {
    const token = getAdminToken()
    if (!token) return
    try {
      const result = await adminPublish(token)
      toast.success(result.message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed')
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Problem editor</h1>
          <p className="text-sm text-muted-foreground">{total} records in gold corpus</p>
        </div>
        <Button onClick={publish}>
          <Upload className="size-4" />
          Sync & export
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search id, title, body…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <Select value={level} onValueChange={(v) => v && setLevel(v)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="OSK">OSK</SelectItem>
            <SelectItem value="OSP">OSP</SelectItem>
            <SelectItem value="OSN">OSN</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
          Errors only
        </label>
        <Select value={solutionStatus} onValueChange={(v) => v && setSolutionStatus(v as typeof solutionStatus)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Solution status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All solutions</SelectItem>
            <SelectItem value="needs_review">Needs review</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="none">No solution yet</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={fetching}>
          {fetching ? 'Loading…' : 'Search'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Solution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/admin/problems/edit?id=${encodeURIComponent(p.id)}`} className="text-primary hover:underline">
                    {p.id}
                  </Link>
                  {p.level && (
                    <div className="mt-1">
                      <LevelBadge level={p.level} />
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-md truncate">{p.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  {GOLD_TOPIC_LABELS[p.topic] ?? p.topic}
                </TableCell>
                <TableCell>
                  {p.error_count > 0 ? (
                    <QualityBadge quality="error" />
                  ) : p.catalog_eligible ? (
                    <QualityBadge quality="clean" />
                  ) : (
                    <QualityBadge quality="repaired" />
                  )}
                </TableCell>
                <TableCell>
                  <SolutionStatusBadge status={p.solution_status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!fetching && problems.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">No problems match your filters.</p>
        )}
      </div>
    </div>
  )
}
