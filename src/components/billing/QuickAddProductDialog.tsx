import * as React from 'react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SECTIONS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Product, Section } from '@/types'

interface QuickAddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Name read from the scanned bill (editable). */
  initialName: string
  /** Rate read from the scanned bill — prefilled as the sale price. */
  initialRate: number
  /** Billed quantity — the opening stock defaults to at least this so the bill can save. */
  initialQty: number
  /** Called with the created product so the caller can link it to the bill line. */
  onCreated: (product: Product) => void
}

function makeSku(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8)
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `SCAN-${slug || 'ITEM'}-${suffix}`
}

export function QuickAddProductDialog({
  open,
  onOpenChange,
  initialName,
  initialRate,
  initialQty,
  onCreated,
}: QuickAddProductDialogProps) {
  const currentUser = useAuthStore((s) => s.currentUser)!
  const godowns = useInventoryStore((s) => s.godowns)
  const addProductDefinition = useInventoryStore((s) => s.addProductDefinition)

  const allowedSections = getUserSections(currentUser.id)

  const [name, setName] = React.useState(initialName)
  const [section, setSection] = React.useState<Section>(allowedSections[0] ?? 'glass')
  const [godownId, setGodownId] = React.useState(godowns[0]?.id ?? '')
  const [unit, setUnit] = React.useState('pcs')
  const [salePrice, setSalePrice] = React.useState(String(initialRate || 0))
  const [openingStock, setOpeningStock] = React.useState(String(Math.max(initialQty || 1, 1)))
  const [lowStockThreshold, setLowStockThreshold] = React.useState('5')
  const [submitting, setSubmitting] = React.useState(false)

  // Reseed the form whenever it opens for a new scanned line.
  React.useEffect(() => {
    if (!open) return
    setName(initialName)
    setSection(allowedSections[0] ?? 'glass')
    setGodownId(godowns[0]?.id ?? '')
    setUnit('pcs')
    setSalePrice(String(initialRate || 0))
    setOpeningStock(String(Math.max(initialQty || 1, 1)))
    setLowStockThreshold('5')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleCreate() {
    const trimmedName = name.trim()
    if (!trimmedName) return toast.error('Enter a product name')
    if (!godownId) return toast.error('Pick a godown')

    try {
      setSubmitting(true)
      const product = await addProductDefinition({
        name: trimmedName,
        sku: makeSku(trimmedName),
        unit: unit.trim() || 'pcs',
        salePrice: Number(salePrice) || 0,
        section,
        godownId,
        lowStockThreshold: Number(lowStockThreshold) || 0,
        openingStock: Number(openingStock) || 0,
      })
      toast.success(`${product.name} added to inventory`)
      onCreated(product)
      onOpenChange(false)
    } catch {
      toast.error('Could not add the product')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to inventory</DialogTitle>
          <DialogDescription>
            This scanned item isn’t in your inventory yet. Add it so the bill can deduct stock.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qap-name">Product name</Label>
            <Input id="qap-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={section} onValueChange={(v) => setSection(v as Section)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedSections.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SECTIONS.find((m) => m.key === s)?.label ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Godown</Label>
              <Select value={godownId} onValueChange={setGodownId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select godown" />
                </SelectTrigger>
                <SelectContent>
                  {godowns.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qap-unit">Unit</Label>
              <Input id="qap-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qap-price">Rate (₹)</Label>
              <Input
                id="qap-price"
                type="number"
                min={0}
                step="0.01"
                className="text-right font-mono tabular-nums"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qap-stock">Opening stock</Label>
              <Input
                id="qap-stock"
                type="number"
                min={0}
                className="text-right font-mono tabular-nums"
                value={openingStock}
                onChange={(e) => setOpeningStock(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qap-threshold">Low-stock alert below</Label>
            <Input
              id="qap-threshold"
              type="number"
              min={0}
              className="w-28 text-right font-mono tabular-nums"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add & link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
