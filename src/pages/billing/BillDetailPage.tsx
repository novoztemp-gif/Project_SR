import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, FilePlus, Printer, Receipt, Scissors } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PrintableBill } from '@/components/billing/PrintableBill'
import { GlassCutterPrintable } from '@/components/billing/GlassCutterPrintable'
import { GlassCashPrintable } from '@/components/billing/GlassCashPrintable'
import { ReceiptEdge } from '@/components/billing/ReceiptEdge'
import { api } from '@/lib/api'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'

type GPPrintMode = 'cutter' | 'cash'

export function BillDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const allowedSections = getUserSections(currentUser.id)
  const rawBill = id ? api.bills.get(id) : undefined
  const bill = id ? api.bills.get(id, allowedSections) : undefined
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
  const hasPrintedRef = useRef(false)

  // Re-arm on every navigation to this route (id/print-type can change
  // without the component remounting) so each visit's requested format
  // and one-shot auto-print behave correctly.
  useEffect(() => {
    hasPrintedRef.current = false
    setGpPrintMode(requestedPrintType ?? 'cash')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, requestedPrintType])

  useEffect(() => {
    if (bill && shouldPrint && !hasPrintedRef.current) {
      hasPrintedRef.current = true
      window.setTimeout(() => window.print(), 0)
    }
  }, [bill, shouldPrint, gpPrintMode])

  function printGP(mode: GPPrintMode) {
    setGpPrintMode(mode)
    window.setTimeout(() => window.print(), 0)
  }

  if (rawBill && !bill) {
    return <Navigate to="/dashboard" replace state={{ denied: true, attempted: `/billing/${id}` }} />
  }

  if (!bill) return <Navigate to="/billing" replace />

  const isGP = bill.billType === 'glass_plywood'

  return (
    <div>
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
