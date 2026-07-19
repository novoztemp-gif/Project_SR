import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Package, Search, User as UserIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { SECTIONS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useBillingStore } from '@/store/billingStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { cn } from '@/lib/utils'
import type { Section } from '@/types'

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const PER_GROUP = 5

type Result =
  | { kind: 'product'; id: string; title: string; subtitle: string; to: string }
  | { kind: 'bill'; id: string; title: string; subtitle: string; to: string }
  | { kind: 'customer'; id: string; title: string; subtitle: string; to: string }

function sectionLabel(section: Section) {
  return SECTIONS.find((s) => s.key === section)?.label ?? section
}

export function TopbarSearch() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)
  const products = useInventoryStore((s) => s.products)
  const bills = useBillingStore((s) => s.bills)

  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const results = React.useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q || !currentUser) return []

    const allowed = getUserSections(currentUser.id)

    // Products — matched by name or SKU, restricted to the user's sections.
    const productHits: Result[] = products
      .filter((p) => allowed.includes(p.section))
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, PER_GROUP)
      .map((p) => ({
        kind: 'product',
        id: p.id,
        title: p.name,
        subtitle: `${sectionLabel(p.section)} · ${p.stock} ${p.unit} in stock`,
        to: '/inventory/products',
      }))

    // Bills — matched by bill number, customer name, or phone.
    const billHits: Result[] = bills
      .filter((b) => {
        return (
          String(b.billNumber).includes(q) ||
          (b.customerName?.toLowerCase().includes(q) ?? false) ||
          b.customerPhone.toLowerCase().includes(q)
        )
      })
      .slice(0, PER_GROUP)
      .map((b) => ({
        kind: 'bill',
        id: b.id,
        title: `Bill #${b.billNumber}${b.customerName ? ` · ${b.customerName}` : ''}`,
        subtitle: `${new Date(b.date).toLocaleDateString('en-IN')} · ${INR.format(b.total - b.discount)}`,
        to: `/billing/${b.id}`,
      }))

    // Customers — unique by name, matched by name or phone, linking to their latest bill.
    const byCustomer = new Map<string, { name: string; phone: string; billId: string; date: number }>()
    for (const b of bills) {
      const name = b.customerName?.trim()
      if (!name) continue
      if (!name.toLowerCase().includes(q) && !b.customerPhone.toLowerCase().includes(q)) continue
      const key = name.toLowerCase()
      const date = new Date(b.date).getTime()
      const existing = byCustomer.get(key)
      if (!existing || date > existing.date) {
        byCustomer.set(key, { name, phone: b.customerPhone, billId: b.id, date })
      }
    }
    const customerHits: Result[] = Array.from(byCustomer.values())
      .slice(0, PER_GROUP)
      .map((c) => ({
        kind: 'customer',
        id: c.billId,
        title: c.name,
        subtitle: c.phone ? `${c.phone} · latest bill` : 'latest bill',
        to: `/billing/${c.billId}`,
      }))

    return [...productHits, ...billHits, ...customerHits]
  }, [query, currentUser, products, bills])

  function choose(result: Result) {
    setQuery('')
    setOpen(false)
    navigate(result.to)
  }

  const grouped: { label: string; icon: React.ReactNode; items: Result[] }[] = [
    { label: 'Products', icon: <Package size={13} />, items: results.filter((r) => r.kind === 'product') },
    { label: 'Bills', icon: <FileText size={13} />, items: results.filter((r) => r.kind === 'bill') },
    { label: 'Customers', icon: <UserIcon size={13} />, items: results.filter((r) => r.kind === 'customer') },
  ].filter((g) => g.items.length > 0)

  const showPanel = open && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        placeholder="Search bills, products, customers…"
        className="h-8 w-56 pl-8 text-xs lg:w-72"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false)
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'Enter' && results[0]) {
            e.preventDefault()
            choose(results[0])
          }
        }}
      />

      {showPanel && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md lg:w-96">
          {grouped.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches for “{query.trim()}”
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.icon}
                    {group.label}
                  </div>
                  {group.items.map((result) => (
                    <button
                      key={`${result.kind}-${result.id}`}
                      type="button"
                      // onMouseDown fires before the input's blur, so the click always lands.
                      onMouseDown={(e) => {
                        e.preventDefault()
                        choose(result)
                      }}
                      className={cn(
                        'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <span className="w-full truncate text-sm">{result.title}</span>
                      <span className="w-full truncate text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
