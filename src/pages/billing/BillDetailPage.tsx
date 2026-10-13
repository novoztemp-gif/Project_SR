import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, FilePlus, Printer, Receipt, Scissors } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PrintableBill } from '@/components/billing/PrintableBill'
import { GlassCutterPrintable } from '@/components/billing/GlassCutterPrintable'
import { GlassCashPrintable } from '@/components/billing/GlassCashPrintable'
import { PaymentTracker } from '@/components/billing/PaymentTracker'
import { ReceiptEdge } from '@/components/billing/ReceiptEdge'
import { api } from '@/lib/api'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import type { SalesBill } from '@/types'

type GPPrintMode = 'cutter' | 'cash'

export function BillDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const allowedSections = getUserSections(currentUser.id)
  const rawBill = id ? api.bills.get(id) : undefined
  const fetchedBill = id ? api.bills.get(id, allowedSections) : undefined
  // api.bills.get reads a non-reactive store snapshot, so a payment edit
  // made right here (PaymentTracker) wouldn't otherwise be reflected until
  // some unrelated re-render happened to re-run it — this override makes
  // the edit show up immediately.
  const [paymentOverride, setPaymentOverride] = useState<SalesBill | null>(null)
  useEffect(() => { setPaymentOverride(null) }, [id])
  const bill = paymentOverride ?? fetchedBill
  const shouldPrint = Boolean((location.state as { print?: boolean } | null)?.print)
  const requestedPrintType = (location.state as { printType?: GPPrintMode } | null)?.printType
  // Which Glass & Plywood format is currently shown/printed — irrelevant
  // for general bills, which always render the single PrintableBill.
  const [gpPrintMode, setGpPrintMode] = useState<GPPrintMode>(requestedPrintType ?? 'cash')
  // Guards against firing window.print() more than once for the same
  // navigation — without it, React StrictMode's dev-only double effect
  // invocation (and any later re-render that changes `bill`'s reference,
  // e.g. a cache refresh) reopens the print dialog again right after the
  // first one closes, since window.print() blocks until dismissed.
  const hasQueuedAutoPrintRef = useRef(false)
  // Formats still waiting to auto-print, in order — for a Glass & Plywood
  // bill this holds both 'cutter' and 'cash' so saving prints them one
  // after the other without the counter opening each manually; for a
  // general bill it's empty (that one-shot print is handled directly).
  const autoPrintQueueRef = useRef<GPPrintMode[]>([])

  // Re-arm on every navigation to this route (id/print-type can change
  // without the component remounting) so each visit's requested format
  // and one-shot auto-print behave correctly.
  useEffect(() => {
    hasQueuedAutoPrintRef.current = false
    autoPrintQueueRef.current = []
    setGpPrintMode(requestedPrintType ?? 'cash')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, requestedPrintType])

  // Kicks off the auto-print sequence exactly once per navigation. For a
  // Glass & Plywood bill this queues both formats and switches to the
  // first one; the effect below actually fires window.print() once that
  // switch has rendered.
  useEffect(() => {
    if (!bill || !shouldPrint || hasQueuedAutoPrintRef.current) return
    hasQueuedAutoPrintRef.current = true
    if (bill.billType === 'glass_plywood') {
      autoPrintQueueRef.current = ['cutter', 'cash']
      setGpPrintMode('cutter')
    } else {
      window.setTimeout(() => window.print(), 0)
    }
  }, [bill, shouldPrint])

  // Fires only once gpPrintMode has actually settled to the queue's next
  // format — printing right inside the effect above would still show
  // whatever format was rendered before setGpPrintMode's update commits.
  useEffect(() => {
    if (autoPrintQueueRef.current[0] !== gpPrintMode) return
    window.setTimeout(() => {
      window.print()
      autoPrintQueueRef.current.shift()
      const next = autoPrintQueueRef.current[0]
      if (next) setGpPrintMode(next)
    }, 0)
  }, [gpPrintMode])

  function printGP(mode: GPPrintMode) {
    setGpPrintMode(mode)
    window.setTimeout(() => window.print(), 0)
  }

  if (rawBill && !bill) {
    return <Navigate to="/dashboard" replace state={{ denied: true, attempted: `/billing/${id}` }} />
  }

  if (!bill) return <Navigate to="/billing" replace />

  const isGP = bill.billType === 'glass_plywood'
  const finalAmount = bill.total + bill.transportationAmount + bill.cuttingCharge - bill.discount
  const balanceAmount = finalAmount - bill.paidAmount

  return (
    <div>
      {balanceAmount > 0 && (
        <div className="report-screen-only flex justify-end mb-2">
          <PaymentTracker
            id={bill.id}
            paidAmount={bill.paidAmount}
            finalAmount={finalAmount}
            balanceAmount={balanceAmount}
            onSave={(id, amount) => api.bills.updatePayment(id, amount)}
            onUpdated={setPaymentOverride}
          />
        </div>
      )}
      <div className="report-screen-only flex items-center justify-between mb-6">
        <Link
          to="/billing"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bills
        </Link>
        <div className="flex items-center gap-2">
          {isGP ? (
            <>
              <Button variant="outline" size="sm" onClick={() => printGP('cutter')}>
                <Scissors className="h-4 w-4 mr-2" />
                Print Cutter Bill
              </Button>
              <Button variant="outline" size="sm" onClick={() => printGP('cash')}>
                <Receipt className="h-4 w-4 mr-2" />
                Print Cash Bill
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/billing/new">
              <FilePlus className="h-4 w-4 mr-2" />
              New bill
            </Link>
          </Button>
        </div>
      </div>

      <div className="print-page-card relative mx-auto max-w-3xl rounded-xl border border-brand-mid bg-white text-gray-900 shadow-lg">
        <ReceiptEdge direction="top" color="#ffffff" stroke="#5F9598" className="receipt-edge" />
        <div className="bg-white">
          {isGP ? (
            gpPrintMode === 'cutter' ? <GlassCutterPrintable bill={bill} /> : <GlassCashPrintable bill={bill} />
          ) : (
            <PrintableBill bill={bill} />
          )}
        </div>
        <ReceiptEdge direction="bottom" color="#ffffff" stroke="#5F9598" className="receipt-edge" />
      </div>
    </div>
  )
}
