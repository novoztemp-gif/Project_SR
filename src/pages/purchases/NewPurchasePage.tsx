import * as React from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, FileText, Plus, Ruler, ScanLine, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { MeasurementsDialog } from '@/components/billing/MeasurementsDialog'
import { ScannerConnectDialog } from '@/components/billing/ScannerConnectDialog'
import { PurchaseScanDialog } from '@/components/purchases/PurchaseScanDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GODOWNS_SEED, SECTIONS, UNITS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import { findBestProductMatch } from '@/lib/productMatch'
import type { ParsedPurchase } from '@/lib/purchaseScan'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { usePurchaseStore } from '@/store/purchaseStore'
import type { Section } from '@/types'
import { cn } from '@/lib/utils'

const NEW_PRODUCT_VALUE = '__new__'
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

const itemSchema = z.object({
  productId: z.string(),
  productName: z.string().min(1, 'Item name is required'),
  sizeDimension: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Min 1'),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.coerce.number().min(0, 'Must be 0 or more'),
  // Only meaningful for a brand-new product (see isNewProduct below) — what
  // it should be sold for, as opposed to unitPrice (what we paid for it).
  salePrice: z.coerce.number().min(0, 'Must be 0 or more'),
  subtotal: z.number().default(0),
  godownId: z.string().min(1, 'Select a godown'),
})

const formSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  date: z.string().min(1),
  section: z.custom<Section>((value) => typeof value === 'string' && SECTIONS.some((section) => section.key === value)),
  imageUrl: z.string().optional(),
  items: z.array(itemSchema).min(1),
  transportationAmount: z.coerce.number().min(0).default(0),
})

type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

const EMPTY_ITEM = {
  productId: '',
  productName: '',
  sizeDimension: '',
  quantity: 1,
  unit: 'pcs',
  unitPrice: 0,
  salePrice: 0,
  subtotal: 0,
  godownId: GODOWNS_SEED[0]?.id ?? '',
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function getSizePlaceholder(section?: Section) {
  switch (section) {
    case 'glass':
    case 'plywood':
      return 'e.g. 6x4 ft'
    case 'painting':
      return 'e.g. 4 ltr / 500 ml'
    case 'plumbing':
      return 'e.g. 1/2 inch / 3 m'
    case 'electrical':
      return 'e.g. 10 m / 6 mm2'
    case 'hardware':
      return 'e.g. 2 inch / Small'
    default:
      return 'e.g. size or dimension'
  }
}

function getProductType(section?: Section) {
  const meta = SECTIONS.find((item) => item.key === section)
  return meta?.label ?? ''
}

export function NewPurchasePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useAuthStore((state) => state.currentUser)!
  const products = useInventoryStore((state) => state.products)
  const addPurchase = usePurchaseStore((state) => state.addPurchase)
  const allowedSections = getUserSections(currentUser.id)
  const [scanOpen, setScanOpen] = React.useState(false)
  const [scannerOpen, setScannerOpen] = React.useState(false)
  const [scannerImageDataUrl, setScannerImageDataUrl] = React.useState<string>()
  const [measurementsIndex, setMeasurementsIndex] = React.useState<number | null>(null)
  const [openProductIndex, setOpenProductIndex] = React.useState<number | null>(null)
  const [productQuery, setProductQuery] = React.useState('')

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorName: '',
      date: todayInputValue(),
      section: allowedSections[0],
      imageUrl: undefined,
      items: [EMPTY_ITEM],
      transportationAmount: 0,
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'items' })
  const watchedSection = useWatch({ control: form.control, name: 'section' }) as Section
  const watchedItems = useWatch({ control: form.control, name: 'items' })
  const watchedTransportation = useWatch({ control: form.control, name: 'transportationAmount' })
  const imageUrl = useWatch({ control: form.control, name: 'imageUrl' })

  const accessibleProducts = products.filter((product) => allowedSections.includes(product.section))
  const total = (watchedItems ?? []).reduce(
    (sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0),
    0
  )
  const transportationAmount = Number(watchedTransportation) || 0
  const grandTotal = total + transportationAmount

  React.useEffect(() => {
    const state = location.state as { restockProductId?: string } | null
    if (!state?.restockProductId) return

    const product = products.find((item) => item.id === state.restockProductId)
    if (!product || !allowedSections.includes(product.section)) return

    form.setValue('section', product.section, { shouldValidate: true })
    form.setValue('items', [{
      productId: product.id,
      productName: product.name,
      sizeDimension: '',
      quantity: 1,
      unit: product.unit,
      unitPrice: product.costPrice,
      salePrice: product.salePrice ?? 0,
      subtotal: 0,
      godownId: product.godownId,
    }], { shouldValidate: true })
    navigate(location.pathname, { replace: true, state: null })
  }, [allowedSections, form, location.pathname, location.state, navigate, products])

  // Seeds the search box with whatever name is already on this line
  // (typically the AI-extracted or scanned product name) so the list opens
  // already filtered to likely matches, instead of dumping the entire
  // catalog for the user to scroll through — cmdk filters CommandItems
  // against this live query automatically as it's typed or pre-set.
  function openProductPicker(index: number, currentName: string) {
    setProductQuery(currentName)
    setOpenProductIndex(index)
  }

  function selectProduct(index: number, value: string) {
    if (value === NEW_PRODUCT_VALUE) {
      form.setValue(`items.${index}.productId`, '', { shouldValidate: true })
      form.setValue(`items.${index}.productName`, '', { shouldValidate: true })
      form.setValue(`items.${index}.unit`, 'pcs')
      form.setValue(`items.${index}.unitPrice`, 0)
      form.setValue(`items.${index}.salePrice`, 0)
      return
    }

    const product = products.find((item) => item.id === value)
    if (!product) return
    form.setValue('section', product.section, { shouldValidate: true })
    form.setValue(`items.${index}.productId`, product.id, { shouldValidate: true })
    form.setValue(`items.${index}.productName`, product.name, { shouldValidate: true })
    form.setValue(`items.${index}.unit`, product.unit, { shouldValidate: true })
    form.setValue(`items.${index}.unitPrice`, product.costPrice, { shouldValidate: true })
    form.setValue(`items.${index}.salePrice`, product.salePrice ?? 0, { shouldValidate: true })
    // Reflect where this product actually already lives — the per-item
    // godown picker still lets the user override it afterward if needed.
    form.setValue(`items.${index}.godownId`, product.godownId, { shouldValidate: true })
  }

  function handlePurchaseExtract(parsed: ParsedPurchase, scannedImageDataUrl: string) {
    form.setValue('vendorName', parsed.vendorName, { shouldValidate: true })
    form.setValue('imageUrl', scannedImageDataUrl, { shouldValidate: true })
    if (parsed.transportationAmount) form.setValue('transportationAmount', parsed.transportationAmount, { shouldValidate: true })

    const currentItems = form.getValues('items') ?? []
    const firstItem = currentItems[0]
    const canReuseFirstItem =
      currentItems.length === 1 &&
      !firstItem?.productId &&
      !firstItem?.productName &&
      Number(firstItem?.quantity ?? 1) === 1 &&
      Number(firstItem?.unitPrice ?? 0) === 0

    const scannedItems = parsed.items.map((item) => {
      const product = findBestProductMatch(item.name, products)

      return {
        productId: product?.id ?? '',
        productName: product?.name ?? item.name,
        sizeDimension: item.sizeDimension || '',
        quantity: item.qty || 1,
        // Matched product: keep using its own established unit rather than
        // whatever the scan guessed. Brand-new item: use the scanned unit —
        // already constrained server-side to one of UNITS.
        unit: product?.unit ?? (item.unit || 'pcs'),
        unitPrice: product?.costPrice ?? item.rate,
        // Matched product: default to its current selling price. Brand-new
        // (unmatched) item: default to the scanned rate as a starting
        // point — it's editable, but this beats leaving it at 0.
        salePrice: product?.salePrice ?? item.rate,
        subtotal: 0,
        // A scanned invoice has no notion of which of our own godowns to
        // use — reflect the matched product's actual godown, or fall back
        // to the default; the user can still change it per row afterward.
        godownId: product?.godownId ?? GODOWNS_SEED[0]?.id ?? '',
      }
    })

    if (canReuseFirstItem && scannedItems.length) {
      replace(scannedItems)
    } else {
      append(scannedItems)
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      const id = await addPurchase({
        vendorName: values.vendorName,
        date: new Date(values.date).toISOString(),
        section: values.section,
        imageUrl: values.imageUrl,
        items: values.items.map((item) => ({
          ...item,
          subtotal: item.quantity * item.unitPrice,
        })),
        transportationAmount: values.transportationAmount,
        createdBy: currentUser.id,
      })

      toast.success('Purchase saved. Print to apply stock.')
      navigate(`/purchases/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save purchase')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">New purchase</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saving keeps stock pending until the voucher is printed.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor and stock destination</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendorName">Vendor name</Label>
                <Input id="vendorName" {...form.register('vendorName')} />
                {form.formState.errors.vendorName && (
                  <p className="text-xs text-destructive">{form.formState.errors.vendorName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" {...form.register('date')} />
              </div>

              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={watchedSection}
                  onValueChange={(value) => form.setValue('section', value as Section, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTIONS.filter((section) => allowedSections.includes(section.key)).map((section) => (
                      <SelectItem key={section.key} value={section.key}>
                        {section.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-base">Total</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Running total</span>
                <span className="font-mono text-lg font-medium tabular-nums">{INR.format(total)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transportationAmount">Transportation (₹)</Label>
                <Input
                  id="transportationAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  className="font-mono tabular-nums text-right"
                  {...form.register('transportationAmount')}
                />
              </div>

              <div className="flex items-center justify-between border-b border-border pb-3 pt-1">
                <span className="font-medium">Grand total</span>
                <span className="font-mono text-2xl font-medium tabular-nums">{INR.format(grandTotal)}</span>
              </div>
              <Button type="submit" className="w-full" size="lg">
                Save purchase
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Stock remains pending until print.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reference photo</CardTitle>
            </CardHeader>
            <CardContent>
              {imageUrl ? (
                <div className="flex items-center gap-3">
                  {imageUrl.startsWith('data:application/pdf') ? (
                    <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-border bg-muted text-muted-foreground">
                      <FileText className="h-6 w-6" />
                      <span className="text-[10px] font-medium">PDF</span>
                    </div>
                  ) : (
                    <img src={imageUrl} alt="Purchase reference" className="h-20 w-20 rounded-md border border-border object-cover" />
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => form.setValue('imageUrl', undefined)}>
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start gap-3 px-4 py-5 text-sm font-normal text-muted-foreground"
                    onClick={() => setScanOpen(true)}
                  >
                    <ScanLine className="h-5 w-5" />
                    Scan the Purchase Bill
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start gap-3 px-4 py-5 text-sm font-normal text-muted-foreground"
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanLine className="h-5 w-5" />
                    Scan from Scanner
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Items</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => append(EMPTY_ITEM)}>
                <Plus className="mr-2 h-4 w-4" />
                Add item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => {
                const item = watchedItems?.[index]
                const isNewProduct = !item?.productId

                return (
                  <div key={field.id} className="grid gap-3 border-b border-border pb-4 last:border-0 sm:grid-cols-[2fr_0.9fr_0.6fr_0.6fr_0.8fr_0.8fr_0.9fr_auto]">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <Popover
                        open={openProductIndex === index}
                        onOpenChange={(open) => {
                          if (open) openProductPicker(index, item?.productName ?? '')
                          else setOpenProductIndex(null)
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            role="combobox"
                            className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-brand-mid focus:outline-none focus:ring-1 focus:ring-brand-mid/30"
                          >
                            <span className={cn('flex-1 truncate text-left', !item?.productName && 'text-muted-foreground')}>
                              {item?.productName || '+ New product'}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Search product…"
                              value={productQuery}
                              onValueChange={setProductQuery}
                            />
                            <CommandList>
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value={NEW_PRODUCT_VALUE}
                                  keywords={['new product']}
                                  onSelect={() => {
                                    selectProduct(index, NEW_PRODUCT_VALUE)
                                    setOpenProductIndex(null)
                                  }}
                                >
                                  + New product
                                </CommandItem>
                              </CommandGroup>
                              <CommandGroup heading="Products">
                                {accessibleProducts.map((product) => {
                                  const sectionLabel = SECTIONS.find((section) => section.key === product.section)?.label ?? product.section
                                  return (
                                    <CommandItem
                                      key={product.id}
                                      value={product.id}
                                      keywords={[product.name, sectionLabel]}
                                      onSelect={() => {
                                        selectProduct(index, product.id)
                                        setOpenProductIndex(null)
                                      }}
                                    >
                                      <span className="flex-1 truncate">{product.name}</span>
                                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{sectionLabel}</span>
                                    </CommandItem>
                                  )
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {isNewProduct && (
                        <Input placeholder="New product name" {...form.register(`items.${index}.productName`)} />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Size / Dimension</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder={getSizePlaceholder(products.find((product) => product.id === item?.productId)?.section)}
                          {...form.register(`items.${index}.sizeDimension`)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          aria-label="Select measurement"
                          onClick={() => setMeasurementsIndex(index)}
                        >
                          <Ruler className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Unit</Label>
                      {isNewProduct ? (
                        <Select
                          value={item?.unit ?? 'pcs'}
                          onValueChange={(value) => form.setValue(`items.${index}.unit`, value, { shouldValidate: true })}
                        >
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
                      ) : (
                        <Input readOnly value={item?.unit ?? ''} />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Qty</Label>
                      {/* step must allow fractional values (e.g. sq.ft quantities like
                          195.3) — without it the browser defaults to step=1 and silently
                          blocks the whole form's submission with no visible error at all. */}
                      <Input type="number" min={1} step="0.01" className="font-mono tabular-nums" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} />
                    </div>

                    <div className="space-y-2">
                      <Label>Unit price</Label>
                      <Input type="number" min={0} step="0.01" className="font-mono tabular-nums" {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
                    </div>

                    <div className="space-y-2">
                      <Label>Selling price</Label>
                      {isNewProduct ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="font-mono tabular-nums"
                          {...form.register(`items.${index}.salePrice`, { valueAsNumber: true })}
                        />
                      ) : (
                        <Input
                          readOnly
                          type="number"
                          className="font-mono tabular-nums text-muted-foreground"
                          value={products.find((product) => product.id === item?.productId)?.salePrice ?? 0}
                          title="Existing product — change its selling price from the Products page"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Godown</Label>
                      <Select
                        value={item?.godownId || GODOWNS_SEED[0]?.id}
                        onValueChange={(value) => form.setValue(`items.${index}.godownId`, value, { shouldValidate: true })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GODOWNS_SEED.map((godown) => (
                            <SelectItem key={godown.id} value={godown.id}>
                              {godown.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-7"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
      </form>

      <PurchaseScanDialog
        open={scanOpen}
        onOpenChange={(open) => {
          setScanOpen(open)
          if (!open) setScannerImageDataUrl(undefined)
        }}
        onExtract={handlePurchaseExtract}
        initialImageDataUrl={scannerImageDataUrl}
        extractingLabel={scannerImageDataUrl ? 'Reading scanned document…' : undefined}
      />
      <ScannerConnectDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        allowPdf
        onImageScanned={(imageDataUrl) => {
          setScannerImageDataUrl(imageDataUrl)
          setScanOpen(true)
        }}
      />

      {measurementsIndex !== null && (
        <MeasurementsDialog
          productType={getProductType(products.find((product) => product.id === watchedItems?.[measurementsIndex]?.productId)?.section)}
          currentValue={watchedItems?.[measurementsIndex]?.sizeDimension ?? ''}
          onSelect={(value) => form.setValue(`items.${measurementsIndex}.sizeDimension`, value, { shouldValidate: true })}
          onClose={() => setMeasurementsIndex(null)}
        />
      )}
    </div>
  )
}
