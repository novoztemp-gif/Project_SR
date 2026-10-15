import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, Receipt, Scissors, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeleteRecordButton } from '@/components/admin/DeleteRecordButton'
import { EmptyState } from '@/components/EmptyState'
import { PaymentStatusCell } from '@/components/billing/PaymentTracker'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useBillingStore } from '@/store/billingStore'
import type { Counter } from '@/store/counterStore'
import { useCounterStore } from '@/store/counterStore'
import { usePurchaseStore } from '@/store/purchaseStore'
import type { SalesBill } from '@/types'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
// Tighter than the 30s inventory poll elsewhere — this page exists
// specifically so an admin can watch every counter's activity live.
const POLL_MS = 15_000

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function sectionLabel(section: string) {
  return SECTIONS.find((s) => s.key === section)?.label ?? section
}

function sectionBadgeStyle(label: string) {
  const color = SECTION_COLORS[label] ?? '#5F9598'
  return { backgroundColor: `${color}20`, borderColor: `${color}40`, color }
}

function CounterChips({
  counters,
  selectedId,
  onSelect,
}: {
  counters: Counter[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (counters.length === 0) {
    return <p className="text-sm text-muted-foreground">No counters set up yet.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {counters.map((counter) => (
        <button
          key={counter.id}
          type="button"
          onClick={() => onSelect(counter.id)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
            selectedId === counter.id
              ? 'border-brand-mid bg-brand-mid/10 text-brand-dark dark:text-brand-light'
              : 'border-border text-muted-foreground hover:bg-muted'
          )}
        >
          {counter.name}
        </button>
      ))}
    </div>
  )
}

function BillsTable({ counterId, billType }: { counterId: string | null; billType: 'general' | 'glass_plywood' }) {
  const navigate = useNavigate()
  const allBills = useBillingStore((s) => s.bills)
  const bills = allBills
    .filter((bill) => bill.billType === billType && bill.createdBy === counterId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (!counterId) return <EmptyState icon={Receipt} title="No counter selected" message="Pick a counter above to see their bills." />
  if (bills.length === 0) return <EmptyState icon={Receipt} title="No bills" message="This counter hasn't saved any bills here yet." />

  const isGP = billType === 'glass_plywood'

  function printBill(bill: SalesBill, printType?: 'cutter' | 'cash') {
    navigate(`/billing/${bill.id}`, { state: { print: true, printType } })
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{isGP ? 'Voucher #' : 'Bill #'}</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Section</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Payment</TableHead>
            <TableHead className="text-center">Print</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => {
            const label = sectionLabel(bill.section)
            const finalAmount = bill.total + bill.transportationAmount + bill.cuttingCharge - bill.discount
            return (
              <TableRow key={bill.id}>
                <TableCell className="font-mono text-sm">{bill.gpVoucherNumber ?? bill.billNumber}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDate(bill.date)}</TableCell>
                <TableCell className="text-sm">
                  {bill.customerName
                    ? <span>{bill.customerName} <span className="text-muted-foreground">{bill.customerPhone}</span></span>
                    : <span className="text-muted-foreground">{bill.customerPhone}</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" style={sectionBadgeStyle(label)}>{label}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm">{INR.format(bill.total)}</TableCell>
                <TableCell className="text-right">
                  <PaymentStatusCell
                    id={bill.id}
                    paidAmount={bill.paidAmount}
                    finalAmount={finalAmount}
                    onSave={(id, amount) => api.bills.updatePayment(id, amount)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  {isGP ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Print Cutter Bill" aria-label="Print Cutter Bill" onClick={() => printBill(bill, 'cutter')}>
                        <Scissors className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Print Cash Bill" aria-label="Print Cash Bill" onClick={() => printBill(bill, 'cash')}>
                        <Receipt className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Print" aria-label="Print" onClick={() => printBill(bill)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <DeleteRecordButton
                    label={`bill ${bill.gpVoucherNumber ?? bill.billNumber}`}
                    onDelete={() => api.bills.remove(bill.id)}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function PurchasesTable({ counterId }: { counterId: string | null }) {
  const navigate = useNavigate()
  const allPurchases = usePurchaseStore((s) => s.purchases)
  const purchases = allPurchases
    .filter((purchase) => purchase.createdBy === counterId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (!counterId) return <EmptyState icon={Receipt} title="No counter selected" message="Pick a counter above to see their purchases." />
  if (purchases.length === 0) return <EmptyState icon={Receipt} title="No purchases" message="This counter hasn't saved any purchases here yet." />

  return (
    <div className="rounded-xl border border-border bg-card overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Voucher #</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Section</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Print</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => {
            const label = sectionLabel(purchase.section)
            const finalAmount = purchase.total + purchase.transportationAmount - purchase.discount
            return (
              <TableRow key={purchase.id}>
                <TableCell className="font-mono text-sm">{purchase.voucherNumber}</TableCell>
                <TableCell className="text-sm">{purchase.vendorName}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDate(purchase.date)}</TableCell>
                <TableCell>
                  <Badge variant="outline" style={sectionBadgeStyle(label)}>{label}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm">{INR.format(purchase.total)}</TableCell>
                <TableCell className="text-right">
                  <PaymentStatusCell
                    id={purchase.id}
                    paidAmount={purchase.paidAmount}
                    finalAmount={finalAmount}
                    onSave={(id, amount) => usePurchaseStore.getState().updatePayment(id, amount)}
                  />
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={purchase.printedAt ? 'border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7]' : 'border-[#EF5350]/40 bg-[#EF5350]/10 text-[#EF5350]'}
                  >
                    {purchase.printedAt ? 'Applied' : 'Pending'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Print"
                    aria-label="Print"
                    onClick={() => navigate(`/purchases/${purchase.id}`, { state: { print: true } })}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell>
                  <DeleteRecordButton
                    label={`purchase ${purchase.voucherNumber}`}
                    onDelete={() => usePurchaseStore.getState().deletePurchase(purchase.id)}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function AllTransactionsPage() {
  const allCounters = useCounterStore((s) => s.counters)
  const counters = allCounters.filter((c) => c.active)
  const [selectedCounterId, setSelectedCounterId] = useState<string | null>(null)

  // First counter auto-selected the moment the roster loads, so this page
  // is never empty on open.
  useEffect(() => {
    if (!selectedCounterId && counters.length > 0) setSelectedCounterId(counters[0].id)
  }, [counters, selectedCounterId])

  // Live view across every counter/section — there's no push layer in this
  // app, so poll while this page is open (plus an immediate refresh on
  // refocus), same pattern AppShell already uses for inventory.
  useEffect(() => {
    function refresh() {
      useBillingStore.getState().hydrate().catch(() => {})
      usePurchaseStore.getState().hydrate().catch(() => {})
    }
    const interval = window.setInterval(refresh, POLL_MS)
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
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-heading">All Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every counter's bills and purchases, browsable one counter at a time. Updates live as new ones are saved.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <Users className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <CounterChips counters={counters} selectedId={selectedCounterId} onSelect={setSelectedCounterId} />
      </div>

      <Tabs defaultValue="bills">
        <TabsList>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="gp">Glass &amp; Plywood Bills</TabsTrigger>
        </TabsList>
        <TabsContent value="bills" className="mt-4">
          <BillsTable counterId={selectedCounterId} billType="general" />
        </TabsContent>
        <TabsContent value="purchases" className="mt-4">
          <PurchasesTable counterId={selectedCounterId} />
        </TabsContent>
        <TabsContent value="gp" className="mt-4">
          <BillsTable counterId={selectedCounterId} billType="glass_plywood" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
