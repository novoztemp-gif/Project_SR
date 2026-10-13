import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SalesBill } from '@/types'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

/**
 * Shown wherever a bill's balance is visible (bill list previews, bill
 * detail) so a pending amount isn't just a dead number — staff can correct
 * the paid amount later (e.g. the customer clears it after delivery) or
 * mark it fully paid in one click, right from where they're already
 * looking at the bill.
 */
export function PaymentTracker({
  bill,
  finalAmount,
  balanceAmount,
  onUpdated,
  className,
}: {
  bill: SalesBill
  finalAmount: number
  balanceAmount: number
  onUpdated: (bill: SalesBill) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(bill.paidAmount))
  const [saving, setSaving] = useState(false)

  if (balanceAmount <= 0) return null

  async function save(paidAmount: number) {
    setSaving(true)
    try {
      const updated = await api.bills.updatePayment(bill.id, paidAmount)
      onUpdated(updated)
      setOpen(false)
      toast.success('Payment updated')
    } catch {
      toast.error('Failed to update payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('flex items-center justify-end gap-1.5', className)}>
      <p className="text-xs font-medium text-amber-600">Amount pending {INR.format(balanceAmount)}</p>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setValue(String(bill.paidAmount)) }}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Edit pending amount" className="text-gray-400 hover:text-gray-700">
            <Pencil className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3" align="end">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Paid amount (₹)</p>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono tabular-nums"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={saving}
              onClick={() => save(finalAmount)}
            >
              Fully paid
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={saving}
              onClick={() => save(Number(value) || 0)}
            >
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/**
 * Table-cell variant: "Paid" when settled, otherwise the same pending
 * amount + edit/fully-paid controls as PaymentTracker. The bills list
 * reads from a reactive store subscription, so a successful edit here
 * re-renders the row on its own — no onUpdated callback needed.
 */
export function PaymentStatusCell({ bill, finalAmount }: { bill: SalesBill; finalAmount: number }) {
  const balanceAmount = finalAmount - bill.paidAmount
  if (balanceAmount <= 0) {
    return <span className="text-xs font-medium text-emerald-600">Paid</span>
  }
  return <PaymentTracker bill={bill} finalAmount={finalAmount} balanceAmount={balanceAmount} onUpdated={() => {}} />
}
