import { Link, useNavigate } from 'react-router-dom'
import { Download, FilePlus, Receipt, ReceiptText, Scissors } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { ReceiptEdge } from '@/components/billing/ReceiptEdge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { exportCsv } from '@/lib/exportCsv'
import { getUserName, getUserSections } from '@/lib/userSections'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { SalesBill } from '@/types'
import { useState } from 'react'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function csvDate(iso?: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : ''
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
  onPrintCutter,
  onPrintCash,
  onView,
}: {
  bill: SalesBill
  onClose: () => void
  onPrintCutter: () => void
  onPrintCash: () => void
  onView: () => void
}) {
  const sectionLabel = SECTIONS.find((s) => s.key === bill.section)?.label ?? bill.section
  const finalAmount = bill.total + bill.transportationAmount - bill.discount
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
            <p className="text-2xl font-bold font-mono text-gray-900">{bill.gpVoucherNumber ?? bill.billNumber}</p>
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
              {balanceAmount > 0 && (
                <p className="mt-1 text-xs text-gray-600">
                  Balance {INR.format(balanceAmount)}
                </p>
              )}
            </div>
          </div>
        </div>
        <ReceiptEdge direction="bottom" color="#ffffff" stroke="#5F9598" className="receipt-edge" />
        <div className="bg-white px-4 py-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onPrintCutter}>
              <Scissors className="h-4 w-4 mr-2" />
              Cutter Bill
            </Button>
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onPrintCash}>
              <Receipt className="h-4 w-4 mr-2" />
              Cash Bill
            </Button>
          </div>
          <Button type="button" size="sm" onClick={onView}>
            View full bill →
          </Button>
        </div>
      </div>
    </aside>
  )
}

export function GlassPlywoodBillListPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const allowedSections = getUserSections(currentUser.id)
  const bills = api.bills.list({ sections: allowedSections }).filter((bill) => bill.billType === 'glass_plywood')
  const sorted = [...bills].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const [selectedBill, setSelectedBill] = useState<SalesBill | null>(null)

  const canCreate = currentUser.role === 'admin' || currentUser.role.startsWith('billing_')

  function exportBills() {
    exportCsv(
      'glass-plywood-bills.csv',
      ['Voucher#', 'Customer', 'Address', 'Items', 'Sq/-', 'Amount', 'Date', 'Delivery', 'Staff', 'Status'],
      sorted.map((bill) => {
        const sqFt = bill.items.reduce((sum, item) => sum + (Number(item.sqFt) || 0), 0)
        const amount = bill.total + bill.transportationAmount - bill.discount

        return [
          bill.gpVoucherNumber ?? bill.billNumber,
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
    toast.success('Glass & Plywood bills exported')
  }

  function viewSelectedBill() {
    if (!selectedBill) return
    navigate(`/billing/${selectedBill.id}`)
  }

  function printBill(billId: string, printType: 'cutter' | 'cash') {
    navigate(`/billing/${billId}`, { state: { print: true, printType } })
  }

  const table = (
    <div className={cn('rounded-xl border border-border bg-card', selectedBill ? 'hidden md:block flex-1 min-w-0 overflow-auto' : 'w-full overflow-auto')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Voucher #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Section</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Print</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((bill) => {
            const sectionLabel = SECTIONS.find((s) => s.key === bill.section)?.label ?? bill.section
            return (
              <TableRow
                key={bill.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedBill(bill)}
              >
                <TableCell className="font-mono text-sm">
                  {bill.gpVoucherNumber ?? bill.billNumber}
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
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Print Cutter Bill"
                      aria-label="Print Cutter Bill"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        printBill(bill.id, 'cutter')
                      }}
                    >
                      <Scissors className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Print Cash Bill"
                      aria-label="Print Cash Bill"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        printBill(bill.id, 'cash')
                      }}
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
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
          <h1 className="page-heading">Glass &amp; Plywood Bills</h1>
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
              <Link to="/billing/glass-plywood/new">
                <FilePlus className="h-4 w-4 mr-2" />
                New Glass &amp; Plywood bill
              </Link>
            </Button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No Glass & Plywood bills found"
          message="Glass and Plywood bills in your accessible sections will appear here after they are saved."
        />
      ) : (
        selectedBill ? (
          <div className="flex flex-col md:flex-row gap-4">
            {table}
            <BillPreviewPanel
              bill={selectedBill}
              onClose={() => setSelectedBill(null)}
              onPrintCutter={() => printBill(selectedBill.id, 'cutter')}
              onPrintCash={() => printBill(selectedBill.id, 'cash')}
              onView={viewSelectedBill}
            />
          </div>
        ) : table
      )}
    </div>
  )
}
