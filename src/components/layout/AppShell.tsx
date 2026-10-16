import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { hydrateAll } from '@/lib/bootstrap'
import { NAV_ITEMS } from '@/lib/navigation'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'

// A kiosk-style tab left open across a deploy has no reason to ever
// re-fetch index.html on its own — it just keeps running whatever JS
// bundle it loaded, however old, indefinitely. version.json (written at
// build time, see vite.config.ts) lets an already-open tab notice a
// newer build exists and prompt a refresh, instead of silently running
// stale matching/pricing/UI logic forever.
const VERSION_POLL_MS = 60_000

// Products/godowns are shared across every user — one counter's sale or
// restock must show up for everyone else's already-open session fast
// enough that a different counter billing the same low-stock item doesn't
// act on numbers that are already wrong. There's no push/websocket layer,
// so poll in the background and also refresh the moment a tab regains
// focus (covers the common "switched away and came back" case
// immediately instead of waiting for the next poll tick). The backend's
// own stock decrement is already atomic and race-safe regardless of this
// value — overselling can't happen — this interval only controls how
// stale the on-screen number can look before that rejection.
const INVENTORY_POLL_MS = 2_000

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

  useEffect(() => {
    let notified = false

    async function checkVersion() {
      if (notified) return
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { buildTime?: number }
        if (typeof data.buildTime === 'number' && data.buildTime !== __BUILD_TIME__) {
          notified = true
          toast.message('A new version is available', {
            description: 'Refresh to get the latest version.',
            duration: Infinity,
            action: { label: 'Refresh', onClick: () => window.location.reload() },
          })
        }
      } catch {
        // Offline/transient — try again on the next tick.
      }
    }

    checkVersion()
    const interval = window.setInterval(checkVersion, VERSION_POLL_MS)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') checkVersion()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', checkVersion)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', checkVersion)
    }
  }, [])

  useEffect(() => {
    if (!ready) return

    function refresh() {
      useInventoryStore.getState().refreshInventory().catch(() => {
        // Background refresh — a transient failure just means we keep
        // showing the last known data until the next successful poll.
      })
    }

    const interval = window.setInterval(refresh, INVENTORY_POLL_MS)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [ready])

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
    <div className="app-shell flex h-screen overflow-hidden bg-background text-foreground">
      {/* Fixed desktop sidebar */}
      <Sidebar />

      {/* Right column: topbar + scrollable main */}
      <div className="app-shell-col flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />

        <main className="app-shell-main flex-1 overflow-y-auto">
          <div className="page-shell mx-auto max-w-7xl px-6 py-6"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
