import * as React from 'react'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SECTIONS, UNITS } from '@/lib/constants'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Godown, Product, Section } from '@/types'

export interface ProductFormValues {
  name: string
  spec: string
  sku: string
  unit: string
  costPrice: number
  /** null = leave/reset the selling price unset. */
  salePrice: number | null
  section: Section
  godownId: string
  lowStockThreshold: number
}

/** Local form state mirrors ProductFormValues except salePrice, kept as a
 * raw string so the field can sit genuinely blank (not "0") while editing —
 * '' means "not set", parsed to null on submit. */
interface FormState extends Omit<ProductFormValues, 'salePrice'> {
  salePrice: string
}

interface ProductFormDialogProps {
  open: boolean
  mode: 'add' | 'edit'
  product?: Product | null
  allowedSections: Section[]
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ProductFormValues) => void
}

function sectionLabel(section: Section) {
  return SECTIONS.find((item) => item.key === section)?.label ?? section
}

function getInitialValues(product: Product | null | undefined, allowedSections: Section[], godowns: Godown[]): FormState {
  return {
    name: product?.name ?? '',
    spec: product?.spec ?? '',
    sku: product?.sku ?? '',
    unit: product?.unit ?? 'pcs',
    costPrice: product?.costPrice ?? 0,
    salePrice: product?.salePrice != null ? String(product.salePrice) : '',
    section: product?.section ?? allowedSections[0] ?? 'glass_plywood',
    godownId: product?.godownId ?? godowns[0]?.id ?? '',
    lowStockThreshold: product?.lowStockThreshold ?? 5,
  }
}

export function ProductFormDialog({
  open,
  mode,
  product,
  allowedSections,
  onOpenChange,
  onSubmit,
}: ProductFormDialogProps) {
  const godowns = useInventoryStore((s) => s.godowns)
  const [values, setValues] = React.useState<FormState>(() => getInitialValues(product, allowedSections, godowns))

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedSalePrice = values.salePrice.trim()
    onSubmit({
      ...values,
      name: values.name.trim(),
      spec: values.spec.trim(),
      sku: values.sku.trim(),
      unit: values.unit.trim(),
      costPrice: Number(values.costPrice) || 0,
      salePrice: trimmedSalePrice === '' ? null : Number(trimmedSalePrice) || 0,
      lowStockThreshold: Number(values.lowStockThreshold) || 0,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add product' : 'Edit product'}</DialogTitle>
          <DialogDescription>
            Product details only. Stock is updated through printed purchases.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="productName">Name</Label>
              <Input id="productName" value={values.name} onChange={(event) => update('name', event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productSpec">Spec</Label>
              <Input id="productSpec" value={values.spec} onChange={(event) => update('spec', event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productSku">SKU</Label>
              <Input id="productSku" value={values.sku} onChange={(event) => update('sku', event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={values.unit} onValueChange={(value) => update('unit', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productCostPrice">Cost price</Label>
              <Input
                id="productCostPrice"
                type="number"
                min={0}
                step="0.01"
                value={values.costPrice}
                onChange={(event) => update('costPrice', Number(event.target.value))}
              />
              <p className="text-xs text-muted-foreground">What we pay for it.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productPrice">Selling price</Label>
              <Input
                id="productPrice"
                type="number"
                min={0}
                step="0.01"
                placeholder="Not set"
                value={values.salePrice}
                onChange={(event) => update('salePrice', event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                What we charge the customer. Leave blank to use the scanned/cost price at bill time.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productMinStock">Min stock</Label>
              <Input
                id="productMinStock"
                type="number"
                min={0}
                value={values.lowStockThreshold}
                onChange={(event) => update('lowStockThreshold', Number(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={values.section} onValueChange={(value) => update('section', value as Section)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.filter((section) => allowedSections.includes(section.key)).map((section) => (
                    <SelectItem key={section.key} value={section.key}>
                      {sectionLabel(section.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Godown</Label>
              <Select value={values.godownId} onValueChange={(value) => update('godownId', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {godowns.map((godown) => (
                    <SelectItem key={godown.id} value={godown.id}>
                      {godown.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {mode === 'add' ? 'Create product' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
