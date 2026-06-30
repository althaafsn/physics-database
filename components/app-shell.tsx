'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Atom, FlaskConical, Menu } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { AdminChrome } from '@/components/admin/admin-chrome'
import { LocaleProvider } from '@/components/locale-provider'
import { SetBuilderProvider, useSetBuilder } from '@/components/set-builder-provider'
import { cn } from '@/lib/utils'

function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  const { items } = useSetBuilder()
  return (
    <header className="flex items-center gap-3 border-b border-border/80 bg-card/70 px-4 py-2.5 backdrop-blur-md lg:hidden print:hidden">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation menu"
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>
      <Link href="/" className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm">
          <Atom className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Bank Soal Fisika
        </span>
      </Link>
      <Link
        href="/sets"
        aria-label="Open set builder"
        className="relative ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <FlaskConical className="size-5" />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
            {items.length}
          </span>
        )}
      </Link>
    </header>
  )
}

function ReaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!navOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [navOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      <AppSidebar className="hidden lg:flex" />

      <div className="lg:hidden">
        <div
          aria-hidden={!navOpen}
          onClick={() => setNavOpen(false)}
          className={cn(
            'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 print:hidden',
            navOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out print:hidden',
            navOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <AppSidebar className="shadow-2xl" onNavigate={() => setNavOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onMenu={() => setNavOpen(true)} />
        <main className="app-main-glow relative flex min-h-0 flex-1 flex-col overflow-hidden print:min-h-0 print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  if (isAdmin) {
    return <AdminChrome>{children}</AdminChrome>
  }

  return (
    <SetBuilderProvider>
      <LocaleProvider>
        <ReaderShell>{children}</ReaderShell>
      </LocaleProvider>
    </SetBuilderProvider>
  )
}
