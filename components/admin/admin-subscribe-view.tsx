'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { adminSubscribe } from '@/lib/admin-api'
import { getAdminToken } from '@/lib/admin-auth'
import { useRequireAdminAuth } from '@/components/admin/use-admin-auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function AdminSubscribeView() {
  const { user, loading, setUser } = useRequireAdminAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function activate(plan: 'monthly' | 'yearly') {
    const token = getAdminToken()
    if (!token) return
    setBusy(true)
    try {
      const result = await adminSubscribe(token, plan)
      toast.success(result.message)
      if (user) {
        setUser({
          ...user,
          subscription_status: result.subscription_status,
          subscription_expires_at: result.subscription_expires_at,
          has_active_subscription: true,
        })
      }
      router.push('/admin/problems')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !user) {
    return <p className="text-muted-foreground">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold">Editor subscription</h1>
      <p className="mb-8 text-muted-foreground">
        Local development uses mock billing — no real payment. Production would use Stripe.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Editor Pro</CardTitle>
          <CardDescription>
            Edit gold corpus, re-validate, sync catalog, and export static data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={() => activate('monthly')}>
            Mock monthly ($0)
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => activate('yearly')}
          >
            Mock yearly ($0)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
