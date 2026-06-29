'use client'

import { useSearchParams } from 'next/navigation'
import { AdminProblemEditorView } from '@/components/admin/admin-problem-editor-view'

export function AdminProblemEditClient() {
  const params = useSearchParams()
  const id = params.get('id')
  if (!id) {
    return <p className="text-muted-foreground">Missing problem id.</p>
  }
  return <AdminProblemEditorView problemId={id} />
}
