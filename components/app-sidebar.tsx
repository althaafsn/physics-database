'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Atom,
  LayoutDashboard,
  Library,
  FlaskConical,
  PenLine,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_UI_ENABLED } from '@/lib/admin-config'
import { ProblemLanguageSwitch } from '@/components/problem-language-switch'
import { useSetBuilder } from '@/components/set-builder-provider'
import useSWR from 'swr'
import { statsFetcher } from '@/lib/api'
import { statsSwrKey } from '@/lib/data-source'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/library', label: 'Problem Library', icon: Library },
  { href: '/topics', label: 'Physics Topics', icon: BookOpen },
  { href: '/sets', label: 'Set Builder', icon: FlaskConical },
  ...(ADMIN_UI_ENABLED
    ? [{ href: '/admin/problems', label: 'Editor', icon: PenLine }]
    : []),
]

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
      )}
    >
      {active ? (
        <span
          className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
          aria-hidden
        />
      ) : null}
      <Icon className={cn('size-4 shrink-0', active && 'text-primary')} />
      {item.label}
    </Link>
  )
}

export function AppSidebar({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { items } = useSetBuilder()
  const { data } = useSWR<{ stats: { totalAvailable: number } }>(
    statsSwrKey(),
    statsFetcher,
  )

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href.startsWith('/admin')) return pathname.startsWith('/admin')
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border/80 bg-sidebar shadow-[1px_0_0_0_oklch(1_0_0_/_0.4)_inset] print:hidden',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20">
          <Atom className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            Bank Soal Fisika
          </p>
          <p className="text-[11px] text-muted-foreground">Olimpiade Corpus</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-1">
        <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Navigate
        </p>
        {NAV.map((item) => (
          <div key={item.href} className="relative">
            <NavLink item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            {item.href === '/sets' && items.length > 0 && (
              <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground shadow-sm">
                {items.length}
              </span>
            )}
          </div>
        ))}
      </nav>

      <div className="m-3 space-y-3 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/20 p-3.5">
        <ProblemLanguageSwitch />
        <p className="border-t border-sidebar-border/60 pt-2.5 text-[11px] text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">
            {data?.stats.totalAvailable ?? '…'}
          </span>{' '}
          problems in catalog
        </p>
      </div>
    </aside>
  )
}
