import type { Role } from '@/types'

export interface NavItem {
  path: string
  label: string
  /** Lucide icon name (resolved to component in Sidebar) */
  iconName: string
  roles: Role[]
  /**
   * false = route exists in the router but has no fixed sidebar link
   * (only used for dynamic segments like /billing/:id)
   */
  showInSidebar: boolean
}

const ALL: Role[]        = ['admin', 'billing_a', 'billing_b']
const ADMIN_ONLY: Role[] = ['admin']

export const NAV_ITEMS: NavItem[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    path: '/dashboard',
    label: 'Dashboard',
    iconName: 'LayoutDashboard',
    roles: ALL,
    showInSidebar: true,
  },

  // ── Billing ────────────────────────────────────────────────────────────────
  {
    path: '/billing',
    label: 'Bills',
    iconName: 'Receipt',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/billing/new',
    label: 'New Bill',
    iconName: 'FilePlus',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/billing/:id',
    label: 'Bill Detail',
    iconName: 'FileText',
    roles: ALL,
    showInSidebar: false,   // dynamic segment — no fixed URL to link to
  },

  // ── Purchase ───────────────────────────────────────────────────────────────
  {
    path: '/purchases',
    label: 'Purchases',
    iconName: 'ShoppingCart',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/purchases/new',
    label: 'New Purchase',
    iconName: 'PackagePlus',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/purchases/:id',
    label: 'Purchase Detail',
    iconName: 'Package',
    roles: ALL,
    showInSidebar: false,   // dynamic segment
  },

  // ── Inventory ──────────────────────────────────────────────────────────────
  {
    path: '/inventory',
    label: 'Inventory',
    iconName: 'Boxes',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/inventory/products',
    label: 'Products',
    iconName: 'Tag',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/inventory/godowns',
    label: 'Godowns',
    iconName: 'Warehouse',
    roles: ALL,
    showInSidebar: true,
  },

  // ── Reports (admin-only) ───────────────────────────────────────────────────
  {
    path: '/inventory/transfers',
    label: 'Transfer Log',
    iconName: 'Repeat2',
    roles: ADMIN_ONLY,
    showInSidebar: true,
  },
  {
    path: '/admin/counters',
    label: 'Counter Management',
    iconName: 'Users',
    roles: ADMIN_ONLY,
    showInSidebar: true,
  },
  {
    path: '/reports/daily',
    label: 'Daily Report',
    iconName: 'BarChart3',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/reports/weekly',
    label: 'Weekly Report',
    iconName: 'TrendingUp',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/reports/monthly',
    label: 'Monthly Report',
    iconName: 'BarChart3',
    roles: ALL,
    showInSidebar: true,
  },
  {
    path: '/reports/yearly',
    label: 'Yearly Report',
    iconName: 'BarChart2',
    roles: ADMIN_ONLY,
    showInSidebar: true,
  },
]

/** Returns flat sidebar items the given role can see (dynamic :id routes excluded) */
export function getNavFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      item.showInSidebar &&
      (item.roles.includes(role) ||
        (role?.startsWith('billing_') && item.roles.some((itemRole) => itemRole.startsWith('billing_'))))
  )
}
