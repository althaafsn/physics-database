'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, LogOut, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdminAuth } from '@/components/admin/use-admin-auth'
import { cn } from '@/lib/utils'

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage =
    pathname === '/admin/login' || pathname === '/admin/signup'
  const { user, logout } = useAdminAuth()

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        {children}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/80 bg-card/50 px-6 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Reader
            </Link>
            <span className="text-border">|</span>
            <Link href="/admin/problems" className="flex items-center gap-2 font-semibold">
              <PenLine className="size-4 text-primary" />
              Editor
            </Link>
          </div>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{user.email}</span>
              {user.has_active_subscription ? (
                <span className="rounded-full bg-quality-clean/20 px-2 py-0.5 text-xs text-quality-clean-foreground">
                  Pro
                </span>
              ) : (
                <Link
                  href="/admin/subscribe"
                  className={cn(
                    'rounded-full bg-quality-error/20 px-2 py-0.5 text-xs text-quality-error-foreground hover:underline',
                  )}
                >
                  Subscribe
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="size-3.5" />
                Log out
              </Button>
            </div>
          )}
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</div>
    </div>
  )
}
