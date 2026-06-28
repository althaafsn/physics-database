'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, FileText, Code2, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { ProblemBody } from '@/components/problem-body'
import { LocaleBadge } from '@/components/locale-badge'
import { Button } from '@/components/ui/button'
import { useSetBuilder } from '@/components/set-builder-provider'
import { useLocale } from '@/components/locale-provider'
import { compileSetMarkdown } from '@/lib/build-set'
import { downloadSetJson, printExamPreview } from '@/lib/print-set-pdf'
import { cn } from '@/lib/utils'

function BackToSetBuilderButton({ size = 'default' }: { size?: 'default' | 'sm' }) {
  return (
    <Button
      nativeButton={false}
      render={<Link href="/sets" />}
      variant="outline"
      size={size}
    >
      <ArrowLeft className="size-4" />
      Back to Set Builder
    </Button>
  )
}

function SetPreviewContent() {
  const { name, items, mode, isReady } = useSetBuilder()
  const { locale } = useLocale()
  const searchParams = useSearchParams()
  const [showSource, setShowSource] = useState(false)
  const autoPrinted = useRef(false)
  const shouldAutoPrint = searchParams.get('print') === '1'

  const markdown = compileSetMarkdown(name, items)

  useEffect(() => {
    if (!isReady || items.length === 0 || !shouldAutoPrint || autoPrinted.current) {
      return
    }
    autoPrinted.current = true
    const timer = window.setTimeout(() => printExamPreview(), 150)
    return () => window.clearTimeout(timer)
  }, [isReady, items.length, shouldAutoPrint])

  const exportPdf = () => {
    printExamPreview()
  }

  const download = (format: 'md' | 'json') => {
    if (format === 'md') {
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/\s+/g, '_')}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Markdown downloaded')
      return
    }

    downloadSetJson(name, {
      name,
      mode,
      locale,
      problem_ids: items.map((p) => p.id),
      exported_at: new Date().toISOString(),
    })
    toast.success('Set JSON downloaded')
  }

  if (!isReady) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader
          title="Exam Preview & Export Console"
          actions={<BackToSetBuilderButton />}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
          <Loader2 className="size-8 animate-spin opacity-60" />
          Loading your exam set…
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader
          title="Exam Preview & Export Console"
          actions={<BackToSetBuilderButton />}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            This draft has no problems yet. Add some from the library or generate a
            random set, then come back to preview or print.
          </p>
          <BackToSetBuilderButton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col print:block print:h-auto">
      <div className="print:hidden">
        <PageHeader
          title="Exam Preview & Export Console"
          description={`${items.length} problems · ${name}`}
          actions={
          <>
            <BackToSetBuilderButton size="sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSource((s) => !s)}
            >
              <Code2 className="size-4" />
              {showSource ? 'Rendered' : 'Markdown Source'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => download('md')}>
              <Download className="size-4" />
              Download MD
            </Button>
            <Button variant="outline" size="sm" onClick={() => download('json')}>
              <Download className="size-4" />
              Save Set (JSON)
            </Button>
            <Button onClick={exportPdf}>
              <Printer className="size-4" />
              Print / Save PDF
            </Button>
          </>
        }
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
        <div
          id="exam-print-root"
          className={cn(
            'exam-paper mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg shadow-black/5 print:max-w-none print:rounded-none print:border-0 print:bg-white print:shadow-none',
            showSource ? 'p-0' : 'p-10 sm:p-12 print:p-8',
          )}
        >
          {showSource ? (
            <pre className="overflow-x-auto bg-muted/30 p-6 font-mono text-xs leading-relaxed text-foreground/90 print:hidden">
              {markdown}
            </pre>
          ) : (
            <article className="space-y-10">
              <header className="border-b border-border/80 pb-6 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
                  {name}
                </h1>
                <p className="mt-2 text-xs text-muted-foreground">
                  {items.length} problems
                </p>
              </header>
              {items.map((p, idx) => (
                <section
                  key={p.id}
                  className="exam-problem space-y-3 border-b border-border/50 pb-8 last:border-0 last:pb-0 print:break-inside-avoid"
                >
                  <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty">
                    {idx + 1}. {p.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {p.level} · {p.year} · {p.topic} · {p.id}
                    </p>
                    <LocaleBadge problem={p} />
                  </div>
                  <div className="text-sm leading-relaxed text-foreground/90">
                    <ProblemBody text={p.body} />
                  </div>
                  {p.figure && !p.body.includes(p.figure) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.figure}
                      alt=""
                      className="max-h-72 max-w-full rounded-lg border border-border/80 bg-muted/20 p-2 object-contain print:max-h-none"
                    />
                  )}
                  <div className="space-y-2">
                    {p.parts.map((part) => (
                      <p key={part.label} className="text-sm leading-relaxed text-foreground/90">
                        <span className="font-semibold text-primary">({part.label})</span>{' '}
                        <ProblemBody text={part.prompt} />
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </article>
          )}
        </div>
      </div>
    </div>
  )
}

export function SetPreviewView() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col">
          <PageHeader
            title="Exam Preview & Export Console"
            actions={<BackToSetBuilderButton />}
          />
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <Loader2 className="size-8 animate-spin opacity-60" />
            Loading preview…
          </div>
        </div>
      }
    >
      <SetPreviewContent />
    </Suspense>
  )
}
