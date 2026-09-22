import { useEffect, useState, type ReactNode } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Pencil, Plus, Ruler, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MeasurementsDialog } from '@/components/billing/MeasurementsDialog'
import { QuickAddProductDialog } from '@/components/billing/QuickAddProductDialog'
import { SetSellingPriceDialog } from '@/components/inventory/SetSellingPriceDialog'
import { ARCH_ICONS, POLISH_SIDE_ICONS } from '@/components/billing/fabricationIcons'
import { resolveManualUnitPrice } from '@/lib/productMatch'
import { computeSqFtFromSize } from '@/lib/sqft'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ARCH_OPTIONS,
  ART_WORK_OPTIONS,
  CORNER_TYPE_OPTIONS,
  HOLE_OPTIONS,
  POLISH_NAME_OPTIONS,
  POLISH_SIDE_OPTIONS,
  SECTIONS,
  type IconPickerOption,
} from '@/lib/constants'
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
  /** Restricts the product picker to these sections on top of the user's own
   * access — used to split Glass/Plywood into their own dedicated billing
   * flow, separate from every other section. Omit for no extra restriction. */
  sectionFilter?: Section[]
}

function getSizePlaceholder(section?: Section) {
  switch (section) {
    case 'glass_plywood':
      return 'e.g. 6×4 ft'
    case 'painting':
      return 'e.g. 4 ltr / 500 ml'
    case 'plumbing':
      return 'e.g. ½ inch / 3 m'
    case 'electrical':
      return 'e.g. 10 m / 6 mm²'
    case 'hardware':
      return 'e.g. 2 inch / Small'
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
    case 'sq.m':
      return 'Sq.M'
    default:
      return unit ? unit.charAt(0).toUpperCase() + unit.slice(1) : ''
  }
}

function getProductType(section?: Section) {
  const meta = SECTIONS.find((item) => item.key === section)
  return meta?.label ?? ''
}

// Glass/plywood fabrication options row — pill-styled selects shown only for
// those two sections. Option lists (ARCH_OPTIONS etc.) are still empty
// placeholders being filled in one field at a time; the pill itself already
// works and just shows "No options yet" until real values are added.
function FabricationOptionPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value?: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-[7rem] gap-1.5 rounded-full border-brand-mid/40 bg-brand-mid/10 px-3 text-xs font-medium text-foreground hover:bg-brand-mid/20 focus:ring-brand-mid/30">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No options yet</p>
        ) : (
          options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

// A pill trigger that opens a small grid of visual icon tiles instead of a
// plain text list — used where the shape/look of the option matters (Arch,
// Polish Side), unlike FabricationOptionPill's plain text options.
function IconOptionPicker({
  label,
  value,
  options,
  icons,
  onChange,
}: {
  label: string
  value?: string
  options: IconPickerOption[]
  icons: Record<string, ReactNode>
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-auto items-center justify-center gap-1.5 rounded-full border border-brand-mid/40 bg-brand-mid/10 px-3 text-xs font-medium text-foreground transition-colors hover:bg-brand-mid/20"
        >
          {selected ? icons[selected.value] : label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground">No options yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'flex items-center justify-center rounded-lg border p-3 text-foreground transition-colors hover:border-brand-mid',
                    isSelected ? 'border-brand-mid ring-2 ring-brand-mid/50' : 'border-border'
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {icons[option.value]}
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function BillLineItem({ index, onRemove, isOnly, sectionFilter }: BillLineItemProps) {
  const [open, setOpen] = useState(false)
  const [measurementsOpen, setMeasurementsOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const { register, setValue, control, formState: { errors } } = useFormContext()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const products = useInventoryStore((s) => s.products)

  const allowedSections = getUserSections(currentUser.id)
  const selectedProductId = useWatch({ control, name: `items.${index}.productId` })
  const scannedProductName = useWatch({ control, name: `items.${index}.productName` })
  const quantity  = Number(useWatch({ control, name: `items.${index}.quantity`  })) || 0
  const unitPrice = Number(useWatch({ control, name: `items.${index}.unitPrice` })) || 0
  const glassSize = String(useWatch({ control, name: `items.${index}.glassSize` }) ?? '')
  const sqFtValue = Number(useWatch({ control, name: `items.${index}.sqFt`      })) || 0

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const usesSqFt = isSqFtUnit(selectedProduct?.unit)
  // Every item on the Glass & Plywood bill gets a Sq.Ft box instead of
  // Model — Model doesn't apply to glass/plywood at all — regardless of
  // the specific product's own unit; Model still shows on the general New
  // Bill page (sectionFilter excludes glass_plywood there).
  const isGPContext = sectionFilter?.includes('glass_plywood') ?? false
  // Sub-classification within the (merged) glass_plywood section — only a
  // literal glass product gets fabrication details, sqft-based stock, and
  // the Polish/Hole/Art amount boxes; plywood/other price and stock the
  // normal qty-based way even when also sold by sq.ft.
  const isGlassProduct = selectedProduct?.productType === 'glass'
  // Auto-fills from Size / Dimension (e.g. "6x6" -> 36) whenever it parses,
  // but stays a normal editable field — sizes with inch marks etc. that
  // don't parse leave it for the counter to type in by hand.
  const computedSqFt = isGPContext ? computeSqFtFromSize(glassSize) : null

  useEffect(() => {
    if (!isGPContext || computedSqFt === null) return
    setValue(`items.${index}.sqFt`, computedSqFt, { shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGPContext, computedSqFt, index])
  // Sq.Ft has its own dedicated column throughout Glass & Plywood billing,
  // so "Qty" there means piece count (e.g. number of sheets), not an area —
  // don't relabel it to "Qty (Sq.Ft)", that reads as if this box is also in
  // sq.ft and duplicates the separate Sq.Ft column right next to it.
  const qtyLabel = isGPContext ? 'Qty' : selectedProduct ? `Qty (${formatUnitLabel(selectedProduct.unit)})` : 'Qty'
  const sizePlaceholder = getSizePlaceholder(selectedProduct?.section)
  const showFabricationOptions = isGlassProduct
  const arch       = String(useWatch({ control, name: `items.${index}.arch`       }) ?? '')
  const polishSide = String(useWatch({ control, name: `items.${index}.polishSide` }) ?? '')
  const polishName = String(useWatch({ control, name: `items.${index}.polishName` }) ?? '')
  const cornerType = String(useWatch({ control, name: `items.${index}.cornerType` }) ?? '')
  const hole       = String(useWatch({ control, name: `items.${index}.hole`       }) ?? '')
  const artWork    = String(useWatch({ control, name: `items.${index}.artWork`    }) ?? '')
  const polishAmt = Number(useWatch({ control, name: `items.${index}.polishAmt` })) || 0
  const holeAmt   = Number(useWatch({ control, name: `items.${index}.holeAmt`   })) || 0
  const artAmt    = Number(useWatch({ control, name: `items.${index}.artAmt`    })) || 0
  const fabricationExtras = isGlassProduct ? polishAmt + holeAmt + artAmt : 0
  const subtotal = (usesSqFt ? sqFtValue * unitPrice : quantity * unitPrice) + fabricationExtras

  const displayedProducts = products.filter(
    (p) => allowedSections.includes(p.section) && (!sectionFilter || sectionFilter.includes(p.section))
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemErrors = (errors.items as any)?.[index]

  function handleSelectProduct(product: Product) {
    setValue(`items.${index}.productId`,   product.id,         { shouldValidate: true })
    setValue(`items.${index}.productName`, product.name)
    setValue(`items.${index}.unit`,        product.unit)
    setValue(`items.${index}.unitPrice`,   resolveManualUnitPrice(product))
    setValue(`items.${index}.quantity`,    1)
    setValue(`items.${index}.sqFt`,        0,                  { shouldValidate: true })
    // A previous selection's glass-only amounts don't carry over to a
    // different product.
    setValue(`items.${index}.polishAmt`,   0)
    setValue(`items.${index}.holeAmt`,     0)
    setValue(`items.${index}.artAmt`,      0)
    setOpen(false)
  }

  // A scanned item that couldn't be matched to inventory: name is filled but no product is linked.
  const isUnmatchedScan = !!scannedProductName && !selectedProductId

  // Link a freshly quick-added product to this line, preserving the scanned quantity.
  function handleLinkCreated(product: Product) {
    setValue(`items.${index}.productId`,   product.id,        { shouldValidate: true })
    setValue(`items.${index}.productName`, product.name)
    setValue(`items.${index}.unit`,        product.unit)
    setValue(`items.${index}.unitPrice`,   resolveManualUnitPrice(product), { shouldValidate: true })
    setValue(`items.${index}.sqFt`,        0)
  }

  return (
    <div className="border-b border-border last:border-0 py-3 space-y-2">
      {/* Single row: S.No | Product | Size/Dimension | Model-or-Sq.Ft | Qty | Rate | Amount | Delete */}
      <div className="grid grid-cols-[3.5rem_minmax(320px,2fr)_11rem_7rem_5.5rem_7rem_7rem_auto] items-start gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">S.No</span>
          <Input
            className="text-center"
            {...register(`items.${index}.serialNumber`)}
          />
        </div>

        <div className="min-w-0 space-y-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Product</span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                className={cn(
                  'w-full min-h-[44px] flex items-center rounded-md border border-input bg-background px-3 py-2 text-base text-left ring-offset-background transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedProduct?.name || scannedProductName ? 'text-foreground' : 'text-muted-foreground',
                  itemErrors?.productId && 'border-destructive'
                )}
              >
                <span className="flex-1 truncate">
                  {selectedProduct?.name || scannedProductName || 'Search for product'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-96" align="start">
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
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
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
            <p className="text-xs text-destructive">{String(itemErrors.productId.message)}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Size / Dimension</span>
          <div className="flex items-center gap-1">
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
        </div>

        {isGPContext ? (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Sq.Ft</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              className="text-right font-mono tabular-nums"
              aria-label="Sq.Ft"
              {...register(`items.${index}.sqFt`)}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Model</span>
            <Input
              placeholder="Model"
              {...register(`items.${index}.model`)}
            />
          </div>
        )}

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{qtyLabel}</span>
          <Input
            type="number"
            className="text-right font-mono tabular-nums"
            min={1}
            // Guard against a self-contradictory min > max: at 0 or negative
            // stock (data drift, concurrent sales, etc.) `max=stock` would
            // silently brick the *entire* form via native HTML5 validation
            // with no visible error anywhere — confirmed as the actual cause
            // of "can't add 10+ items" reports. The backend's own stock
            // check already rejects genuinely insufficient orders with a
            // clear toast, so this is purely a UI nudge, not the source of
            // truth — skip it rather than let it break submission.
            max={selectedProduct && selectedProduct.stock >= 1 ? selectedProduct.stock : undefined}
            {...register(`items.${index}.quantity`)}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Rate</span>
            {selectedProduct && (
              <button
                type="button"
                onClick={() => setPriceDialogOpen(true)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Set selling price"
                title="Set selling price"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          <Input
            type="number"
            className="text-right font-mono tabular-nums"
            step="0.01"
            min={0}
            {...register(`items.${index}.unitPrice`)}
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Amount</span>
          <div className="flex h-10 items-center justify-end font-mono tabular-nums text-sm font-medium">
            {INR.format(subtotal)}
          </div>
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn('mt-6 shrink-0', isOnly && 'invisible')}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {itemErrors?.quantity && (
        <p className="text-xs text-destructive">{String(itemErrors.quantity.message)}</p>
      )}

      {isGPContext && selectedProduct && !selectedProduct.productType && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          This product has no Product Type set — fabrication details and sq.ft-based stock won't apply until you
          set it to Glass in Inventory.
        </p>
      )}

      {isGlassProduct && (
        <div className="flex flex-wrap gap-2">
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="Polish Amt."
            aria-label="Polish amount"
            className="w-32 text-right font-mono tabular-nums"
            {...register(`items.${index}.polishAmt`)}
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="Hole Amt."
            aria-label="Hole amount"
            className="w-32 text-right font-mono tabular-nums"
            {...register(`items.${index}.holeAmt`)}
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="Art Amt."
            aria-label="Art amount"
            className="w-32 text-right font-mono tabular-nums"
            {...register(`items.${index}.artAmt`)}
          />
        </div>
      )}

      {showFabricationOptions && (
        <div className="flex flex-wrap gap-2">
          <IconOptionPicker
            label="Arch"
            value={arch}
            options={ARCH_OPTIONS}
            icons={ARCH_ICONS}
            onChange={(value) => setValue(`items.${index}.arch`, value, { shouldValidate: true })}
          />
          <IconOptionPicker
            label="Polish Side"
            value={polishSide}
            options={POLISH_SIDE_OPTIONS}
            icons={POLISH_SIDE_ICONS}
            onChange={(value) => setValue(`items.${index}.polishSide`, value, { shouldValidate: true })}
          />
          <FabricationOptionPill
            label="Polish Name"
            value={polishName}
            options={POLISH_NAME_OPTIONS}
            onChange={(value) => setValue(`items.${index}.polishName`, value, { shouldValidate: true })}
          />
          <FabricationOptionPill
            label="Corner Type"
            value={cornerType}
            options={CORNER_TYPE_OPTIONS}
            onChange={(value) => setValue(`items.${index}.cornerType`, value, { shouldValidate: true })}
          />
          <FabricationOptionPill
            label="Hole"
            value={hole}
            options={HOLE_OPTIONS}
            onChange={(value) => setValue(`items.${index}.hole`, value, { shouldValidate: true })}
          />
          <FabricationOptionPill
            label="Art Work"
            value={artWork}
            options={ART_WORK_OPTIONS}
            onChange={(value) => setValue(`items.${index}.artWork`, value, { shouldValidate: true })}
          />
        </div>
      )}

      {measurementsOpen && (
        <MeasurementsDialog
          productType={getProductType(selectedProduct?.section)}
          currentValue={glassSize}
          onSelect={(value) => setValue(`items.${index}.glassSize`, value, { shouldValidate: true })}
          onClose={() => setMeasurementsOpen(false)}
        />
      )}

      <SetSellingPriceDialog
        product={priceDialogOpen ? (selectedProduct ?? null) : null}
        onOpenChange={(nextOpen) => setPriceDialogOpen(nextOpen)}
        onSaved={(updated) => setValue(`items.${index}.unitPrice`, resolveManualUnitPrice(updated), { shouldValidate: true })}
      />

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
