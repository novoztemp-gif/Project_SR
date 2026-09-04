import {
  BarChart2,
  BarChart3,
  Boxes,
  FilePlus,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  PackagePlus,
  Receipt,
  Repeat2,
  ShoppingCart,
  Tag,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { COMPANY } from '@/lib/brand'
import { SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { getNavFor } from '@/lib/navigation'
import { getUserSections } from '@/lib/userSections'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { Role } from '@/types'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Receipt,
  Repeat2,
  FilePlus,
  FileText,
  ShoppingCart,
  PackagePlus,
  Package,
  Boxes,
  Tag,
  Warehouse,
  BarChart2,
  BarChart3,
  TrendingUp,
  Users,
}

const ROLE_LABELS: Partial<Record<Role, string>> = {
  admin: 'Administrator',
}

interface SidebarInnerProps {
  onNavigate?: () => void
}

export function SidebarInner({ onNavigate }: SidebarInnerProps) {
  const { currentUser, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navItems = currentUser
    ? getNavFor(currentUser.role).filter(
        (item) => !(currentUser.role?.startsWith('billing_') && item.path === '/reports/monthly')
      )
    : []
  const accessibleSections = currentUser
    ? SECTIONS.filter((section) => getUserSections(currentUser.id).includes(section.key))
    : []

  return (
    <div className="relative flex h-full flex-col bg-card text-foreground">
      <div className="absolute left-0 top-0 h-full w-[3px] bg-brand-mid shadow-[0_0_18px_#5F9598]" />

      <div className="px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-mid font-mono text-sm font-bold text-white glow-brand dark:text-brand-deepest">
            SR
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{COMPANY.shortName}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{COMPANY.place}</p>
          </div>
        </div>
      </div>

      <Separator className="bg-border" />

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map((item, index) => {
            const Icon = ICON_MAP[item.iconName]
            const startsAdmin = item.path.startsWith('/admin') && !navItems[index - 1]?.path.startsWith('/admin')
            const startsAnalytics = item.path.startsWith('/reports') && !navItems[index - 1]?.path.startsWith('/reports')

            return (
              <li key={item.path}>
                {startsAdmin && (
                  <div className="px-3 pb-1 pt-4">
                    <div className="mb-2 h-px bg-brand-border" />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted">Admin</p>
                  </div>
                )}
                {startsAnalytics && (
                  <div className="px-3 pb-1 pt-4">
                    <div className="mb-2 h-px bg-brand-border" />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted">Analytics</p>
                  </div>
                )}
                <NavLink
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm',
                      'border border-transparent text-muted-foreground transition-all duration-200',
                      'hover:border-brand-mid hover:border-l-2 hover:border-l-brand-mid hover:bg-muted hover:pl-[10px] hover:text-foreground',
                      isActive &&
                        'border border-brand-mid/30 bg-gradient-to-r from-brand-mid/10 to-transparent pl-[10px] font-medium text-brand-mid glow-brand dark:text-brand-light',
                    )
                  }
                >
                  {Icon && <Icon size={16} strokeWidth={1.75} />}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <Separator className="bg-border" />

      {accessibleSections.length > 0 && (
        <div className="px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sections</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {accessibleSections.map((section) => (
              <div key={section.key} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-4 rounded-full"
                  style={{
                    backgroundColor: SECTION_COLORS[section.label],
                    boxShadow: `0 0 10px ${SECTION_COLORS[section.label]}80`,
                  }}
                />
                <span className="text-xs text-muted-foreground">{section.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator className="bg-border" />

      {currentUser && (
        <div className="m-3 flex items-center justify-between rounded-xl border border-border bg-muted px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-mid font-mono text-xs font-bold text-white dark:text-brand-deepest">
              {currentUser.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{currentUser.name}</p>
              <p className="font-mono text-[10px] text-brand-mid dark:text-brand-light">
                {ROLE_LABELS[currentUser.role] ?? 'Billing Counter'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Log out"
            className="ml-2 shrink-0 text-muted-foreground hover:bg-card hover:text-[#EF5350]"
          >
            <LogOut size={15} />
          </Button>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <SidebarInner />
    </aside>
  )
}
