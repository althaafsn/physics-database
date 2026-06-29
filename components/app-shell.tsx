'use client'

import { usePathname } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { AdminChrome } from '@/components/admin/admin-chrome'
import { LocaleProvider } from '@/components/locale-provider'
import { SetBuilderProvider } from '@/components/set-builder-provider'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  if (isAdmin) {
    return <AdminChrome>{children}</AdminChrome>
  }

  return (
    <SetBuilderProvider>
      <LocaleProvider>
        <div className="flex h-screen overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
          <AppSidebar />
          <main className="app-main-glow relative flex min-h-0 flex-1 flex-col overflow-hidden print:min-h-0 print:overflow-visible">
            {children}
          </main>
        </div>
      </LocaleProvider>
    </SetBuilderProvider>
  )
}
