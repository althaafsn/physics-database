import { Suspense } from 'react'
import { AdminProblemEditClient } from './edit-client'

export default function AdminProblemEditPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading problem…</p>}>
      <AdminProblemEditClient />
    </Suspense>
  )
}
