import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

/**
 * Shown wherever a sales bill or purchase voucher's balance is visible
 * (list previews, detail pages) so a pending amount isn't just a dead
 * number — staff can correct the paid amount later (e.g. the
 * customer/vendor clears it after delivery) or mark it fully paid in one
 * click, right from where they're already looking. `onSave` is the
 * caller's own update call (bills vs. purchases hit different endpoints),
 * kept generic here so this one component works for both.
 */
export function PaymentTracker<T>({
  id,
  paidAmount,
  finalAmount,
  balanceAmount,
  onSave,
  onUpdated,
  className,
}: {
  id: string
  paidAmount: number
  finalAmount: number
  balanceAmount: number
  onSave: (id: string, paidAmount: number) => Promise<T>
  onUpdated: (result: T) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(paidAmount))
  const [saving, setSaving] = useState(false)

  if (balanceAmount <= 0) return null

  async function save(newPaidAmount: number) {
    setSaving(true)
    try {
      const updated = await onSave(id, newPaidAmount)
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
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setValue(String(paidAmount)) }}>
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
 * amount + edit/fully-paid controls as PaymentTracker. Callers whose list
 * reads from a reactive store subscription can pass a no-op onUpdated —
 * a successful edit re-renders the row on its own.
 */
export function PaymentStatusCell<T>({
  id,
  paidAmount,
  finalAmount,
  onSave,
  onUpdated,
}: {
  id: string
  paidAmount: number
  finalAmount: number
  onSave: (id: string, paidAmount: number) => Promise<T>
  onUpdated?: (result: T) => void
}) {
  const balanceAmount = finalAmount - paidAmount
  if (balanceAmount <= 0) {
    return <span className="text-xs font-medium text-emerald-600">Paid</span>
  }
  return (
    <PaymentTracker
      id={id}
      paidAmount={paidAmount}
      finalAmount={finalAmount}
      balanceAmount={balanceAmount}
      onSave={onSave}
      onUpdated={onUpdated ?? (() => {})}
    />
  )
}
