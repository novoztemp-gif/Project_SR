import { Link, Navigate, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'

import { PrintablePurchase } from '@/components/purchases/PrintablePurchase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { usePurchaseStore } from '@/store/purchaseStore'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function PurchaseDetailPage() {
  const { id } = useParams()
  const currentUser = useAuthStore((state) => state.currentUser)!
  const bill = usePurchaseStore((state) => (id ? state.getPurchase(id) : undefined))
  const applyAndPrint = usePurchaseStore((state) => state.applyAndPrint)

  if (bill && !getUserSections(currentUser.id).includes(bill.section)) {
    return <Navigate to="/dashboard" replace state={{ denied: true, attempted: `/purchases/${id}` }} />
  }

  if (!bill) return <Navigate to="/purchases" replace />

  const isApplied = bill.printedAt !== null

  async function handlePrintAndApply() {
    if (!bill) return
    try {
      await applyAndPrint(bill.id)
      toast.success('Stock applied. Opening print dialog.')
      window.print()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply stock')
    }
  }

  function handleReprint() {
    toast.info('Opening reprint dialog. Stock is unchanged.')
    window.print()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button asChild variant="ghost">
          <Link to="/purchases">&larr; Back to purchases</Link>
        </Button>

        <div className="flex items-center gap-3">
          {isApplied && bill.printedAt && (
            <p className="text-sm text-brand-dark dark:text-brand-light">
              Stock applied on {formatDate(bill.printedAt)}
            </p>
          )}
          {isApplied ? (
            <Button variant="outline" onClick={handleReprint}>
              <Printer className="mr-2 h-4 w-4" />
              Reprint
            </Button>
          ) : (
            <Button onClick={handlePrintAndApply}>
              <Printer className="mr-2 h-4 w-4" />
              Print &amp; apply stock
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <Badge
          variant="secondary"
          className={
            isApplied
              ? 'border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7]'
              : 'border-[#EF5350]/40 bg-[#EF5350]/10 text-[#EF5350]'
          }
        >
          {isApplied ? 'Applied' : 'Pending'}
        </Badge>
      </div>

      {bill.imageUrl && (
        <div className="mx-auto mb-4 max-w-3xl">
          <img
            src={bill.imageUrl}
            alt="Purchase reference"
            className="h-24 rounded-md border border-border object-cover"
          />
        </div>
      )}

      <div className="mx-auto max-w-3xl rounded-xl border border-brand-mid bg-white text-gray-900 shadow-lg">
        <PrintablePurchase bill={bill} />
      </div>
    </div>
  )
}
