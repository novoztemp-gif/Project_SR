import { Link, useNavigate } from 'react-router-dom'
import { Download, FilePlus, Printer, ReceiptText } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeleteRecordButton } from '@/components/admin/DeleteRecordButton'
import { EmptyState } from '@/components/EmptyState'
import { PaymentStatusCell, PaymentTracker } from '@/components/billing/PaymentTracker'
import { ReceiptEdge } from '@/components/billing/ReceiptEdge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { exportCsv } from '@/lib/exportCsv'
import { getUserName, getUserSections } from '@/lib/userSections'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useBillingStore } from '@/store/billingStore'
import type { SalesBill } from '@/types'
import { useEffect, useState } from 'react'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// format(), not .toISOString(), to match the on-screen date (local), not
// UTC — otherwise a bill made before ~5:30am IST exports the previous day.
function csvDate(iso?: string) {
  return iso ? format(new Date(iso), 'yyyy-MM-dd') : ''
}

function sectionBadgeStyle(sectionLabel: string) {
  const color = SECTION_COLORS[sectionLabel] ?? '#5F9598'
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}40`,
    color,
  }
}

function statusBadgeStyle(status: SalesBill['status']) {
  const color = status === 'paid' ? '#4CAF50' : status === 'partial' ? '#FFB74D' : '#EF5350'
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}40`,
    color,
  }
}

function BillPreviewPanel({
  bill,
  onClose,
  onPrint,
  onView,
  onBillUpdated,
}: {
  bill: SalesBill
  onClose: () => void
  onPrint: () => void
  onView: () => void
  onBillUpdated: (bill: SalesBill) => void
}) {
  const sectionLabel = SECTIONS.find((s) => s.key === bill.section)?.label ?? bill.section
  const finalAmount = bill.total + bill.transportationAmount + bill.cuttingCharge - bill.discount
  const balanceAmount = finalAmount - bill.paidAmount

  return (
    <aside className="w-full md:w-96 md:flex-shrink-0 transition-transform duration-250 translate-x-0">
      <button
        type="button"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground md:hidden"
        onClick={onClose}
      >
        ← Back to bills
      </button>

      <div className="rounded-lg border border-brand-mid bg-white p-2 text-gray-900 shadow-lg">
        <ReceiptEdge direction="top" color="#ffffff" stroke="#5F9598" className="receipt-edge" />
        <div className="bg-white px-5 py-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="text-lg leading-none text-gray-500 hover:text-gray-900"
              onClick={onClose}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>

          <p className="text-center font-mono text-xs">SR PLYWOOD & GLASSES · MELPURAM</p>

          <div className="mt-4">
            <p className="text-2xl font-bold font-mono text-gray-900">{bill.billNumber}</p>
            <p className="text-xs text-gray-600">{formatDate(bill.date)}</p>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium text-gray-900">
              {bill.customerName || bill.customerPhone}
            </p>
            <Badge variant="outline" style={sectionBadgeStyle(sectionLabel)}>{sectionLabel}</Badge>
          </div>

          <div className="my-4 border-t border-gray-300" />

          <div className="grid grid-cols-[1fr_3rem_5rem] gap-2 bg-gray-100 px-1 py-1 text-xs font-medium text-gray-700">
            <span>Material Name</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Amount</span>
          </div>

          <div className="mt-2 space-y-1">
            {bill.items.map((item, index) => (
              <div key={`${item.productId}-${index}`} className="grid grid-cols-[1fr_3rem_5rem] gap-2 text-xs text-gray-800">
                <span className="truncate">{item.productName}</span>
                <span className="text-right tabular-nums">{item.quantity}</span>
                <span className="text-right font-mono tabular-nums">{INR.format(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="my-4 border-t border-gray-300" />

          <div className="flex items-center justify-between gap-3">
            <Badge variant="outline" style={statusBadgeStyle(bill.status)}>{bill.status}</Badge>
            <div className="text-right">
              <p className="text-xs text-gray-600">Final Amount</p>
              <p className="font-mono font-bold tabular-nums text-brand-dark">{INR.format(finalAmount)}</p>
              <PaymentTracker
                id={bill.id}
                paidAmount={bill.paidAmount}
                finalAmount={finalAmount}
                balanceAmount={balanceAmount}
                onSave={(id, amount) => api.bills.updatePayment(id, amount)}
                onUpdated={onBillUpdated}
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <ReceiptEdge direction="bottom" color="#ffffff" stroke="#5F9598" className="receipt-edge" />
        <div className="bg-white px-4 py-3 flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button type="button" size="sm" className="flex-1" onClick={onView}>
            View full bill →
          </Button>
        </div>
      </div>
    </aside>
  )
}

export function BillHistoryPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const allowedSections = getUserSections(currentUser.id)
  // Reactive subscription (not api.bills.list's plain getState() snapshot) so
  // a payment edit made right in the table updates that row immediately.
  // Glass & Plywood bills live in their own dedicated list/flow now — keep
  // them out of the general Bills list so the two stay cleanly separated.
  const allBills = useBillingStore((s) => s.bills)
  const bills = allBills.filter((bill) => allowedSections.includes(bill.section) && bill.billType !== 'glass_plywood')
  const sorted = [...bills].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const [selectedBill, setSelectedBill] = useState<SalesBill | null>(null)

  // Deleting the currently-previewed bill (admin only) removes it from
  // `bills` on the next render — close the stale preview instead of
  // continuing to show a bill that no longer exists.
  useEffect(() => {
    if (selectedBill && !bills.some((b) => b.id === selectedBill.id)) setSelectedBill(null)
  }, [bills, selectedBill])

  const canCreate = currentUser.role === 'admin' || currentUser.role.startsWith('billing_')
  const isAdmin = currentUser.role === 'admin'

  function exportBills() {
    exportCsv(
      'bills.csv',
      ['Bill#', 'Customer', 'Address', 'Items', 'Sq/-', 'Amount', 'Date', 'Delivery', 'Staff', 'Status'],
      sorted.map((bill) => {
        const sqFt = bill.items.reduce((sum, item) => sum + (Number(item.sqFt) || 0), 0)
        const amount = bill.total + bill.transportationAmount + bill.cuttingCharge - bill.discount

        return [
          bill.billNumber,
          bill.customerName || bill.customerPhone,
          bill.customerAddress ?? '',
          bill.items.length,
          sqFt,
          amount,
          csvDate(bill.date),
          csvDate(bill.deliveryDate),
          getUserName(bill.createdBy),
          bill.status,
        ]
      })
    )
    toast.success('Bills exported')
  }

  function viewSelectedBill() {
    if (!selectedBill) return
    navigate(`/billing/${selectedBill.id}`)
  }

  function printSelectedBill() {
    if (!selectedBill) return
    navigate(`/billing/${selectedBill.id}`, { state: { print: true } })
  }

  const table = (
    <div className={cn('rounded-xl border border-border bg-card', selectedBill ? 'hidden md:block flex-1 min-w-0 overflow-auto' : 'w-full overflow-auto')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bill #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Section</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Payment</TableHead>
            {isAdmin && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((bill) => {
            const sectionLabel = SECTIONS.find((s) => s.key === bill.section)?.label ?? bill.section
            const finalAmount = bill.total + bill.transportationAmount + bill.cuttingCharge - bill.discount
            return (
              <TableRow
                key={bill.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedBill(bill)}
              >
                <TableCell className="font-mono text-sm">
                  {bill.billNumber}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(bill.date)}
                </TableCell>
                <TableCell className="text-sm">
                  {bill.customerName
                    ? <span>{bill.customerName} <span className="text-muted-foreground">{bill.customerPhone}</span></span>
                    : <span className="text-muted-foreground">{bill.customerPhone}</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" style={sectionBadgeStyle(sectionLabel)}>{sectionLabel}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm">
                  {INR.format(bill.total)}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <PaymentStatusCell
                    id={bill.id}
                    paidAmount={bill.paidAmount}
                    finalAmount={finalAmount}
                    onSave={(id, amount) => api.bills.updatePayment(id, amount)}
                  />
                </TableCell>
                {isAdmin && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DeleteRecordButton label={`bill ${bill.billNumber}`} onDelete={() => api.bills.remove(bill.id)} />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-heading">Bills</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sorted.length} bill{sorted.length !== 1 ? 's' : ''} in your sections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportBills}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {canCreate && (
            <Button asChild size="sm">
              <Link to="/billing/new">
                <FilePlus className="h-4 w-4 mr-2" />
                New bill
              </Link>
            </Button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No bills found"
          message="Bills in your accessible sections will appear here after they are saved."
        />
      ) : (
        selectedBill ? (
          <div className="flex flex-col md:flex-row gap-4">
            {table}
            <BillPreviewPanel
              bill={selectedBill}
              onClose={() => setSelectedBill(null)}
              onPrint={printSelectedBill}
              onView={viewSelectedBill}
              onBillUpdated={setSelectedBill}
            />
          </div>
        ) : table
      )}
    </div>
  )
}
