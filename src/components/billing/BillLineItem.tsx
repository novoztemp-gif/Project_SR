import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Plus, Ruler, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MeasurementsDialog } from '@/components/billing/MeasurementsDialog'
import { QuickAddProductDialog } from '@/components/billing/QuickAddProductDialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SECTIONS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Product, Section } from '@/types'
import { cn } from '@/lib/utils'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

interface BillLineItemProps {
  index: number
  onRemove: () => void
  isOnly: boolean
}

function getSizePlaceholder(section?: Section) {
  switch (section) {
    case 'glass':
    case 'plywood':
      return 'e.g. 6×4 ft'
    case 'painting':
      return 'e.g. 4 ltr / 500 ml'
    case 'plumbing':
      return 'e.g. ½ inch / 3 m'
    case 'electrical':
      return 'e.g. 10 m / 6 mm²'
    default:
      return 'e.g. size or dimension'
  }
}

function isSqFtUnit(unit?: string) {
  return unit?.trim().toLowerCase() === 'sq.ft'
}

function formatUnitLabel(unit?: string) {
  const normalized = unit?.trim().toLowerCase()

  switch (normalized) {
    case 'pcs':
    case 'pc':
    case 'piece':
    case 'pieces':
      return 'Piece'
    case 'ltr':
    case 'liter':
    case 'litre':
      return 'Liter'
    case 'kg':
      return 'Kg'
    case 'sq.ft':
      return 'Sq.Ft'
    default:
      return unit ? unit.charAt(0).toUpperCase() + unit.slice(1) : ''
  }
}

function getProductType(section?: Section) {
  const meta = SECTIONS.find((item) => item.key === section)
  return meta?.label ?? ''
}

export function BillLineItem({ index, onRemove, isOnly }: BillLineItemProps) {
  const [open, setOpen] = useState(false)
  const [measurementsOpen, setMeasurementsOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const { register, setValue, control, formState: { errors } } = useFormContext()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const products = useInventoryStore((s) => s.products)

  const allowedSections = getUserSections(currentUser.id)
  const selectedProductId = useWatch({ control, name: `items.${index}.productId` })
  const scannedProductName = useWatch({ control, name: `items.${index}.productName` })
  const quantity  = Number(useWatch({ control, name: `items.${index}.quantity`  })) || 0
  const unitPrice = Number(useWatch({ control, name: `items.${index}.unitPrice` })) || 0
  const sqFt      = Number(useWatch({ control, name: `items.${index}.sqFt`      })) || 0
  const glassSize = String(useWatch({ control, name: `items.${index}.glassSize` }) ?? '')

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const usesSqFt = isSqFtUnit(selectedProduct?.unit)
  const subtotal = usesSqFt ? sqFt * unitPrice : quantity * unitPrice
  const qtyLabel = selectedProduct ? `Qty (${formatUnitLabel(selectedProduct.unit)})` : 'Qty'
  const sizePlaceholder = getSizePlaceholder(selectedProduct?.section)

  const displayedProducts = products.filter((p) => allowedSections.includes(p.section))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemErrors = (errors.items as any)?.[index]

  function handleSelectProduct(product: Product) {
    setValue(`items.${index}.productId`,   product.id,         { shouldValidate: true })
    setValue(`items.${index}.productName`, product.name)
    setValue(`items.${index}.unit`,        product.unit)
    setValue(`items.${index}.unitPrice`,   product.salePrice)
    setValue(`items.${index}.quantity`,    1)
    setValue(`items.${index}.sqFt`,        0,                  { shouldValidate: true })
    setOpen(false)
  }

  // A scanned item that couldn't be matched to inventory: name is filled but no product is linked.
  const isUnmatchedScan = !!scannedProductName && !selectedProductId

  // Link a freshly quick-added product to this line, preserving the scanned quantity.
  function handleLinkCreated(product: Product) {
    setValue(`items.${index}.productId`,   product.id,        { shouldValidate: true })
    setValue(`items.${index}.productName`, product.name)
    setValue(`items.${index}.unit`,        product.unit)
    setValue(`items.${index}.unitPrice`,   product.salePrice, { shouldValidate: true })
    setValue(`items.${index}.sqFt`,        0)
  }

  return (
    <div className="border-b border-border last:border-0 py-3 space-y-2">
      {/* Row 1: Name | Size / Dimension | Model */}
      <div className="grid grid-cols-[minmax(280px,1fr)_10rem_6rem] items-start gap-2">
        <div className="w-full min-w-[280px]">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                className={cn(
                  'w-full min-h-[44px] min-w-[280px] flex items-center rounded-md border border-input bg-background px-3 py-2 text-base text-left ring-offset-background transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedProduct?.name || scannedProductName ? 'text-foreground' : 'text-muted-foreground',
                  itemErrors?.productId && 'border-destructive'
                )}
              >
                <span className="flex-1 truncate">
                  {selectedProduct?.name ?? scannedProductName ?? 'Search for product'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-80" align="start">
              <Command>
                <CommandInput placeholder="Search product…" />
                <CommandList>
                  <CommandEmpty>No products found.</CommandEmpty>
                  {allowedSections.map((section) => {
                    const group = displayedProducts.filter((p) => p.section === section)
                    if (!group.length) return null
                    const label = SECTIONS.find((s) => s.key === section)?.label ?? section
                    return (
                      <CommandGroup key={section} heading={label}>
                        {group.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={`${product.section}-${product.id}-${product.name}`}
                            className="flex cursor-pointer items-center bg-transparent px-3 py-2 text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                            onSelect={() => handleSelectProduct(product)}
                          >
                            <span className="flex-1">{product.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              ({product.stock} {product.unit})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {isUnmatchedScan ? (
            <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
              <span className="text-xs text-amber-700 dark:text-amber-400">Not in inventory</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setQuickAddOpen(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add to inventory
              </Button>
            </div>
          ) : itemErrors?.productId ? (
            <p className="text-xs text-destructive mt-0.5">{String(itemErrors.productId.message)}</p>
          ) : null}
        </div>

        <div className="flex w-40 items-center gap-1">
          <Input
            aria-label="Size / Dimension"
            placeholder={sizePlaceholder}
            className="min-w-0 flex-1"
            {...register(`items.${index}.glassSize`)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label="Select measurement"
            onClick={() => setMeasurementsOpen(true)}
          >
            <Ruler className="h-4 w-4" />
          </Button>
        </div>
        <Input
          placeholder="Model"
          className="w-24"
          {...register(`items.${index}.model`)}
        />
      </div>

      {/* Row 2: Qty | optional Sq.Ft | Rate | Amount | Delete */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{qtyLabel}</span>
          <Input
            type="number"
            className="w-16 text-right font-mono tabular-nums"
            min={1}
            max={selectedProduct?.stock ?? undefined}
            {...register(`items.${index}.quantity`)}
          />
        </div>
        {usesSqFt && (
          <div className="flex items-center gap-1.5">
            {selectedProduct && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">Sq.Ft</span>
            )}
            <Input
              type="number"
              className="w-20 text-right font-mono tabular-nums"
              step="0.01"
              min={0}
              placeholder="0"
              {...register(`items.${index}.sqFt`)}
            />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Rate</span>
          <Input
            type="number"
            className="w-24 text-right font-mono tabular-nums"
            step="0.01"
            min={0}
            {...register(`items.${index}.unitPrice`)}
          />
        </div>
        <div className="flex-1 text-right font-mono tabular-nums text-sm font-medium">
          {INR.format(subtotal)}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn('shrink-0', isOnly && 'invisible')}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {itemErrors?.quantity && (
        <p className="text-xs text-destructive">{String(itemErrors.quantity.message)}</p>
      )}

      {measurementsOpen && (
        <MeasurementsDialog
          productType={getProductType(selectedProduct?.section)}
          currentValue={glassSize}
          onSelect={(value) => setValue(`items.${index}.glassSize`, value, { shouldValidate: true })}
          onClose={() => setMeasurementsOpen(false)}
        />
      )}

      <QuickAddProductDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialName={String(scannedProductName ?? '')}
        initialRate={unitPrice}
        initialQty={quantity}
        onCreated={handleLinkCreated}
      />
    </div>
  )
}
