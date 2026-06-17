import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { hydrateAll } from '@/lib/bootstrap'
import { NAV_ITEMS } from '@/lib/navigation'
import { useAuthStore } from '@/store/authStore'

/** Derive a human-readable page title from the current pathname */
function useTitleFromRoute(): string {
  const { pathname } = useLocation()
  const match = NAV_ITEMS.find((item) => {
    // Exact match first, then prefix match for dynamic segments (:id)
    if (item.path === pathname) return true
    const staticPrefix = item.path.replace(/\/:[^/]+/g, '')
    return staticPrefix !== item.path && pathname.startsWith(staticPrefix)
  })
  return match?.label ?? 'Dashboard'
}

export function AppShell() {
  const title = useTitleFromRoute()
  const currentUser = useAuthStore((s) => s.currentUser)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    let active = true
    setReady(false)
    setFailed(false)
    hydrateAll(currentUser.role === 'admin')
      .then(() => active && setReady(true))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [currentUser?.id, currentUser?.role])

  if (failed) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div>
          <p className="text-lg font-semibold">Couldn’t load your data</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The server may be unreachable. Check that the backend is running, then reload.
          </p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your workspace…
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Fixed desktop sidebar */}
      <Sidebar />

      {/* Right column: topbar + scrollable main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />

        <main className="flex-1 overflow-y-auto">
          <div className="page-shell mx-auto max-w-7xl px-6 py-6"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
