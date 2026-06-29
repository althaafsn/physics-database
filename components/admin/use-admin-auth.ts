'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminMe, type AdminUser } from '@/lib/admin-api'
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth'

export function useAdminAuth() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = getAdminToken()
    if (!token) {
      setLoading(false)
      return
    }
    adminMe(token)
      .then(setUser)
      .catch(() => clearAdminToken())
      .finally(() => setLoading(false))
  }, [])

  function logout() {
    clearAdminToken()
    setUser(null)
    router.push('/admin/login')
  }

  return { user, loading, logout, setUser }
}

export function useRequireAdminAuth(options?: { requireSubscription?: boolean }) {
  const auth = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    if (auth.loading) return
    if (!getAdminToken()) {
      router.replace('/admin/login')
      return
    }
    if (options?.requireSubscription && auth.user && !auth.user.has_active_subscription) {
      router.replace('/admin/subscribe')
    }
  }, [auth.loading, auth.user, options?.requireSubscription, router])

  return auth
}
