import { Link, useNavigate } from 'react-router-dom'
import * as React from 'react'
import { ClipboardList, Download, Plus, Printer } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { exportCsv } from '@/lib/exportCsv'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { usePurchaseStore } from '@/store/purchaseStore'
import type { Godown, PurchaseBill } from '@/types'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function csvDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

function getSectionLabel(sectionKey: PurchaseBill['section']) {
  return SECTIONS.find((section) => section.key === sectionKey)?.label ?? sectionKey
}

function getGodownLabel(godownId: string, godowns: Godown[]) {
  return godowns.find((godown) => godown.id === godownId)?.name ?? godownId
}

// Items can each target a different godown now — a single purchase.godownId
// is only ever a legacy/first-item fallback, so summarize honestly: the
// shared godown when every item agrees, otherwise say so explicitly rather
// than silently showing just one of several.
function getPurchaseGodownLabel(purchase: PurchaseBill, godowns: Godown[]) {
  const ids = Array.from(new Set(purchase.items.map((item) => item.godownId).filter((id): id is string => Boolean(id))))
  if (ids.length === 0) return getGodownLabel(purchase.godownId, godowns)
  if (ids.length === 1) return getGodownLabel(ids[0], godowns)
  return 'Multiple godowns'
}

function sectionBadgeStyle(sectionLabel: string) {
  const color = SECTION_COLORS[sectionLabel] ?? '#5F9598'
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}40`,
    color,
  }
}

function purchaseStatusStyle(isApplied: boolean) {
  const color = isApplied ? '#4FC3F7' : '#EF5350'
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}40`,
    color,
  }
}

function PurchasePreviewPanel({
  purchase,
  onClose,
  onPrint,
  onView,
}: {
  purchase: PurchaseBill
  onClose: () => void
  onPrint: () => void
  onView: () => void
}) {
  const godowns = useInventoryStore((s) => s.godowns)
  const sectionLabel = getSectionLabel(purchase.section)
  const godownLabel = getPurchaseGodownLabel(purchase, godowns)
  const isApplied = Boolean(purchase.printedAt)

  return (
    <aside className="w-full md:w-96 md:flex-shrink-0">
      <button
        type="button"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground md:hidden"
        onClick={onClose}
      >
        &larr; Back to purchases
      </button>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{purchase.voucherNumber}</p>
            <h2 className="mt-1 truncate text-lg font-medium text-foreground">{purchase.vendorName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(purchase.date)}</p>
          </div>
          <button
            type="button"
            className="text-lg leading-none text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close preview"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" style={sectionBadgeStyle(sectionLabel)}>{sectionLabel}</Badge>
            <Badge variant="outline">{godownLabel}</Badge>
            <Badge variant="outline" style={purchaseStatusStyle(isApplied)}>
              {isApplied && purchase.printedAt ? `Applied ${formatDate(purchase.printedAt)}` : 'Pending'}
            </Badge>
          </div>

          <div className="rounded-lg border border-brand-mid bg-white px-3 py-3 text-gray-900">
            <div className="grid grid-cols-[1fr_3.5rem_5rem] gap-2 border-b border-gray-300 bg-gray-100 px-1 py-1 text-xs font-medium text-gray-600">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Total</span>
            </div>
            <div className="divide-y divide-gray-200">
              {purchase.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="grid grid-cols-[1fr_3.5rem_5rem] gap-2 py-2 text-sm odd:bg-white even:bg-gray-50">
                  <div className="min-w-0">
                    <p className="truncate text-gray-800">{item.productName}</p>
                    <p className="font-mono text-xs tabular-nums text-gray-600">{INR.format(item.unitPrice)} / {item.unit}</p>
                  </div>
                  <span className="text-right font-mono tabular-nums text-gray-600">{item.quantity}</span>
                  <span className="text-right font-mono tabular-nums text-gray-900">{INR.format(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Grand total</span>
            <span className="font-mono text-xl font-medium tabular-nums text-foreground">{INR.format(purchase.total)}</span>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button type="button" size="sm" className="flex-1" onClick={onView}>
            View full voucher
          </Button>
        </div>
      </div>
    </aside>
  )
}

export function PurchaseListPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)!
  const purchases = usePurchaseStore((state) => state.purchases)
  const godowns = useInventoryStore((state) => state.godowns)
  const accessibleSections = getUserSections(currentUser.id)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const sortedPurchases = React.useMemo(
    () =>
      purchases
        .filter((purchase) => accessibleSections.includes(purchase.section))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [accessibleSections, purchases]
  )

  const selectedPurchase = sortedPurchases.find((purchase) => purchase.id === selectedId) ?? null

  React.useEffect(() => {
    if (!selectedId) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedId(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId])

  React.useEffect(() => {
    if (selectedId && !selectedPurchase) setSelectedId(null)
  }, [selectedId, selectedPurchase])

  function exportPurchases() {
    exportCsv(
      'purchases.csv',
      ['Voucher#', 'Vendor', 'Date', 'Section', 'Godown', 'Items', 'Total', 'Status'],
      sortedPurchases.map((purchase) => [
        purchase.voucherNumber,
        purchase.vendorName,
        csvDate(purchase.date),
        getSectionLabel(purchase.section),
        getPurchaseGodownLabel(purchase, godowns),
        purchase.items.map((item) => `${item.productName} x ${item.quantity} ${item.unit}`).join('; '),
        purchase.total,
        purchase.printedAt ? 'Applied' : 'Pending',
      ])
    )
  }

  function printSelectedPurchase() {
    if (!selectedPurchase) return
    navigate(`/purchases/${selectedPurchase.id}`, { state: { print: true } })
  }

  function viewSelectedPurchase() {
    if (!selectedPurchase) return
    navigate(`/purchases/${selectedPurchase.id}`)
  }

  const table = (
    <Card className={selectedPurchase ? 'hidden md:block flex-1 min-w-0 overflow-auto border-border bg-card' : 'border-border bg-card'}>
      <CardHeader>
        <CardTitle className="text-base">Purchase vouchers</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Godown</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPurchases.map((purchase) => {
              const sectionLabel = getSectionLabel(purchase.section)
              const godownLabel = getPurchaseGodownLabel(purchase, godowns)
              const isSelected = purchase.id === selectedId

              return (
                <TableRow
                  key={purchase.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50 data-[selected=true]:bg-muted"
                  data-selected={isSelected}
                  onClick={() => setSelectedId((current) => (current === purchase.id ? null : purchase.id))}
                >
                  <TableCell className="font-medium">{purchase.vendorName}</TableCell>
                  <TableCell>{formatDate(purchase.date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" style={sectionBadgeStyle(sectionLabel)}>{sectionLabel}</Badge>
                  </TableCell>
                  <TableCell>{godownLabel}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {purchase.items.length}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {INR.format(purchase.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" style={purchaseStatusStyle(Boolean(purchase.printedAt))}>
                      {purchase.printedAt ? `Applied ${formatDate(purchase.printedAt)}` : 'Pending'}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-heading">Purchases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Purchase stock is applied only after printing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={exportPurchases}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild>
            <Link to="/purchases/new">
              <Plus className="mr-2 h-4 w-4" />
              New purchase
            </Link>
          </Button>
        </div>
      </div>

      {sortedPurchases.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={ClipboardList}
              title="No purchases yet"
              message="Saved purchase vouchers will appear here before stock is applied."
            />
          </CardContent>
        </Card>
      ) : selectedPurchase ? (
        <div className="flex flex-col gap-4 md:flex-row">
          {table}
          <PurchasePreviewPanel
            purchase={selectedPurchase}
            onClose={() => setSelectedId(null)}
            onPrint={printSelectedPurchase}
            onView={viewSelectedPurchase}
          />
        </div>
      ) : table}
    </div>
  )
}
