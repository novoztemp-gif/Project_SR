import { Download, Printer, ReceiptText } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { EmptyState } from '@/components/EmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SECTIONS } from '@/lib/constants'
import { getUserName } from '@/lib/userSections'
import { exportCsv } from '@/lib/exportCsv'
import {
  getBillFinalAmount,
  getBillSqFt,
  getBillStatus,
  scopeBillsForUser,
  selectBillsForDate,
  selectDayTotals,
} from '@/lib/reportSelectors'
import { useAuthStore } from '@/store/authStore'
import { useBillingStore } from '@/store/billingStore'

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function csvDate(iso?: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : ''
}

function displayDate(iso?: string) {
  return iso ? format(new Date(iso), 'dd MMM yyyy') : '-'
}

function staffName(userId: string) {
  return getUserName(userId)
}

export function DailyReportPage() {
  const currentUser = useAuthStore((state) => state.currentUser)!
  const bills = useBillingStore((state) => state.bills)
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(today)

  const reportDate = parseISO(selectedDate)
  const scopedBills = scopeBillsForUser(bills, currentUser)
  const dayBills = selectBillsForDate(scopedBills, reportDate)
    .sort((a, b) => a.billNumber - b.billNumber)
  const totals = selectDayTotals(dayBills)

  function exportDailyCsv() {
    exportCsv(
      `daily-report-${selectedDate}.csv`,
      ['Bill#', 'Customer', 'Address', 'Items', 'Sq/-', 'Amount', 'Date', 'Delivery', 'Staff', 'Status'],
      dayBills.map((bill) => [
        bill.billNumber,
        bill.customerName || bill.customerPhone,
        bill.customerAddress ?? '',
        bill.items.length,
        getBillSqFt(bill),
        getBillFinalAmount(bill),
        csvDate(bill.date),
        csvDate(bill.deliveryDate),
        staffName(bill.createdBy),
        getBillStatus(bill),
      ]),
    )
    toast.success('Daily report exported')
  }

  return (
    <div className="space-y-6">
      <div className="report-screen-only flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium">Daily Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dayBills.length} bill{dayBills.length !== 1 ? 's' : ''} for {format(reportDate, 'dd MMM yyyy')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateInput
            value={selectedDate}
            onChange={(value) => setSelectedDate(value || today)}
            className="w-36"
            ariaLabel="Report date"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print report
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportDailyCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <section className="report-printable space-y-4">
        <div className="report-print-header text-center">
          <p className="text-lg font-semibold">SR PLYWOOD &amp; GLASSES</p>
          <p className="text-sm">SR PLYWOOD &amp; GLASSES · MELPURAM</p>
          <p className="mt-2 font-mono text-sm tabular-nums">{format(reportDate, 'dd MMMM yyyy')}</p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Section</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Sq.ft</TableHead>
              <TableHead className="text-right">Final Amount</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dayBills.map((bill) => {
              const sectionLabel = SECTIONS.find((section) => section.key === bill.section)?.label ?? bill.section
              return (
                <TableRow key={bill.id}>
                  <TableCell className="font-mono tabular-nums">{bill.billNumber}</TableCell>
                  <TableCell>{bill.customerName || bill.customerPhone}</TableCell>
                  <TableCell>{bill.customerAddress ?? '-'}</TableCell>
                  <TableCell>{sectionLabel}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{bill.items.length}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{getBillSqFt(bill)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{INR.format(getBillFinalAmount(bill))}</TableCell>
                  <TableCell>{displayDate(bill.deliveryDate)}</TableCell>
                  <TableCell>{staffName(bill.createdBy)}</TableCell>
                  <TableCell className="capitalize">{getBillStatus(bill)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell colSpan={5}>Day total</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{totals.sqFt}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{INR.format(totals.revenue)}</TableCell>
              <TableCell colSpan={3}>{totals.billCount} bill{totals.billCount !== 1 ? 's' : ''}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        {dayBills.length === 0 && (
          <EmptyState
            icon={ReceiptText}
            title="No bills on this date"
            message="Pick another date or create a bill to populate the daily report."
            className="report-screen-only mt-4"
          />
        )}
      </section>
    </div>
  )
}
