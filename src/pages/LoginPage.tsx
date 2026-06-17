import { useEffect, useState } from 'react'
import { ArrowRight, Hammer, Loader2, Lock, Power, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COMPANY } from '@/lib/brand'
import { SECTION_COLORS } from '@/lib/constants'
import { http } from '@/lib/apiClient'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { AuthUser } from '@/types'

const AVATAR_CLASSES: Record<string, string> = {
  deep: 'from-brand-dark to-brand-deepest',
  mint: 'from-brand-mid to-brand-dark',
  leaf: 'from-brand-light to-brand-mid',
  forest: 'from-brand-mid to-brand-deepest',
  highlight: 'from-brand-light to-brand-dark',
  charcoal: 'from-brand-dark to-brand-deepest',
}

function UserCard({
  user,
  index,
  onSelect,
}: {
  user: AuthUser
  index: number
  onSelect: (user: AuthUser) => void
}) {
  const isAdmin = user.role === 'admin'
  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className="group h-full text-left transition duration-200 hover:-translate-y-1"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition duration-200 group-hover:border-brand-mid/50 group-hover:glow-brand">
        <div className="flex items-start justify-between gap-4">
          <div className={cn('flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br font-mono text-sm font-bold text-white ring-2 ring-transparent transition group-hover:ring-brand-mid/50', AVATAR_CLASSES[user.avatarColor ?? 'deep'] ?? AVATAR_CLASSES.deep)}>
            {user.initials ?? (isAdmin ? 'SV' : '?')}
          </div>
          <span className="rounded-full border border-brand-light/40 bg-brand-light/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-dark dark:text-brand-light glow-brand">
            {isAdmin ? 'Owner' : user.label}
          </span>
        </div>

        <div className="mt-6 flex-1">
          <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
          <p className="mt-1 text-sm font-medium text-brand-mid dark:text-brand-light">
            {isAdmin ? 'Full administration workspace' : 'Billing counter workspace'}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {isAdmin ? (
              <span className="rounded-full border border-brand-light/30 bg-brand-light/10 px-2.5 py-1 text-xs font-medium text-brand-dark dark:text-brand-light">
                All sections
              </span>
            ) : (
              user.process.map((process) => (
                <span
                  key={process}
                  className="rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `${SECTION_COLORS[process]}20`,
                    borderColor: `${SECTION_COLORS[process]}40`,
                    color: SECTION_COLORS[process],
                  }}
                >
                  {process}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Tap to sign in</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-brand-mid transition group-hover:border-brand-mid group-hover:bg-brand-mid group-hover:text-white group-hover:glow-brand dark:group-hover:text-brand-deepest">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </button>
  )
}

export function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()

  const [users, setUsers] = useState<AuthUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selected, setSelected] = useState<AuthUser | null>(null)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    http
      .get<AuthUser[]>('/auth/users')
      .then((list) => {
        if (active) setUsers(list)
      })
      .catch(() => {
        if (active) toast.error('Could not reach the server. Is the backend running?')
      })
      .finally(() => {
        if (active) setLoadingUsers(false)
      })
    return () => {
      active = false
    }
  }, [])

  const counters = users.filter((u) => u.role.startsWith('billing_'))
  const admin = users.find((u) => u.role === 'admin')

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    setSubmitting(true)
    try {
      await login(selected.id, password)
      navigate('/dashboard')
    } catch {
      toast.error('Incorrect password')
    } finally {
      setSubmitting(false)
    }
  }

  function closeDialog() {
    setSelected(null)
    setPassword('')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-5 text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-32 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-brand-mid/10 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-mid text-white glow-brand dark:text-brand-deepest">
            <Hammer className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground sm:text-base">{COMPANY.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{COMPANY.place}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-brand-mid/30 bg-brand-mid/10 px-3 py-2 text-xs font-medium text-brand-mid dark:text-brand-light">
          <span className="h-2 w-2 rounded-full bg-[#4CAF50] shadow-[0_0_10px_#4CAF50] animate-pulse" />
          <ShieldCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Secured workspace</span>
          <span className="sm:hidden">Secured</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl py-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Choose your <span className="text-gradient-brand">workspace</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Sign in to the counter assigned to your process, or enter the owner workspace for full administration.
          </p>
        </div>

        {loadingUsers ? (
          <div className="mt-16 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading workspaces…
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {counters.map((counter, index) => (
              <UserCard key={counter.id} user={counter} index={index} onSelect={setSelected} />
            ))}
            {admin && (
              <UserCard user={admin} index={counters.length} onSelect={setSelected} />
            )}
          </div>
        )}
      </main>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || !password}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <footer className="relative z-10 px-5 pb-8 text-center text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Power className="h-3.5 w-3.5" />
          2026 {COMPANY.name} - Crafted for daily business use
        </span>
      </footer>
    </div>
  )
}
