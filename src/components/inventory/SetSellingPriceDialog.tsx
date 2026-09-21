import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Product } from '@/types'

interface SetSellingPriceDialogProps {
  product: Product | null
  onOpenChange: (open: boolean) => void
  /** Fires with the updated product right after a successful save — lets a
   * caller like the bill form sync its own in-progress Rate field. */
  onSaved?: (product: Product) => void
}

/**
 * Fast, single-purpose "set the selling price" action for one product —
 * distinct from the full (admin-only) Edit dialog. Any counter with access
 * to the product's section can use this one, via its own narrow API route.
 * Until this is used, a product's salePrice stays null (unset), and billing
 * falls back to a scanned price or cost price instead.
 */
export function SetSellingPriceDialog({ product, onOpenChange, onSaved }: SetSellingPriceDialogProps) {
  const setSalePrice = useInventoryStore((s) => s.setSalePrice)
  const [price, setPrice] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (product) setPrice(product.salePrice != null ? String(product.salePrice) : '')
  }, [product])

  async function handleSave() {
    if (!product) return
    const trimmed = price.trim()
    const parsed = trimmed === '' ? null : Number(trimmed) || 0

    try {
      setSubmitting(true)
      const updated = await setSalePrice(product.id, parsed)
      toast.success(parsed === null ? 'Selling price cleared' : 'Selling price saved')
      onSaved?.(updated)
      onOpenChange(false)
    } catch {
      toast.error('Could not save the selling price')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Selling price</DialogTitle>
          <DialogDescription>{product?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="sellingPrice">Amount (₹)</Label>
          <Input
            id="sellingPrice"
            type="number"
            min={0}
            step="0.01"
            autoFocus
            placeholder="Not set"
            className="font-mono tabular-nums"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used on every bill for this product. Leave blank to fall back to a scanned/cost price at bill time.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
