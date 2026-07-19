import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, ScanLine } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Form } from '@/components/ui/form'
import { BillLineItem } from '@/components/billing/BillLineItem'
import { BillScanDialog } from '@/components/billing/BillScanDialog'
import { ScannerConnectDialog } from '@/components/billing/ScannerConnectDialog'
import { api, InsufficientStockError } from '@/lib/api'
import type { ParsedBill } from '@/lib/billScan'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'

const PHONE_RE = /^[+]?[\d\s-]{7,15}$/

const itemSchema = z.object({
  productId:   z.string().min(1, 'Select a product'),
  productName: z.string(),
  quantity:    z.coerce.number().min(1, 'Min 1'),
  unit:        z.string(),
  glassSize:   z.string().optional(),
  model:       z.string().optional(),
  sqFt:        z.coerce.number().min(0).default(0),
  unitPrice:   z.coerce.number().min(0),
})

const billSchema = z.object({
  customerName:    z.string().optional(),
  customerAddress: z.string().optional(),
  customerPhone:   z.string().refine((v) => !v || PHONE_RE.test(v), 'Invalid phone number'),
  bookingDate:     z.string().optional(),
  deliveryDate:    z.string().optional(),
  transport:       z.string().optional(),
  transportTime:   z.string().optional(),
  items:           z.array(itemSchema).min(1),
  discount:        z.coerce.number().min(0).default(0),
  paidAmount:      z.coerce.number().min(0).default(0),
})

type FormInput = z.input<typeof billSchema>
type FormValues = z.output<typeof billSchema>

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const todayIso   = new Date().toISOString().slice(0, 10)
const todayLabel = new Date().toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
})
const EMPTY_ITEM = {
  productId: '', productName: '', quantity: 1, unit: '',
  glassSize: '', model: '', sqFt: 0, unitPrice: 0,
}

function isSqFtUnit(unit?: string) {
  return unit?.trim().toLowerCase() === 'sq.ft'
}

/** Split a product name into lowercase alphanumeric tokens for order-insensitive matching. */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function NewBillPage() {
  const navigate    = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)!
  const products    = useInventoryStore((s) => s.products)
  const year        = new Date().getFullYear()
  const [scanOpen, setScanOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerImageDataUrl, setScannerImageDataUrl] = useState<string>()

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      customerName: '', customerAddress: '', customerPhone: '',
      bookingDate: todayIso, deliveryDate: '',
      transport: '', transportTime: '',
      items: [EMPTY_ITEM],
      discount: 0, paidAmount: 0,
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchedItems    = useWatch({ control: form.control, name: 'items'      })
  const watchedDiscount = useWatch({ control: form.control, name: 'discount'   })
  const watchedPaid     = useWatch({ control: form.control, name: 'paidAmount' })

  const total = (watchedItems ?? []).reduce((sum, item) => {
    const sqFt  = Number(item.sqFt)      || 0
    const qty   = Number(item.quantity)  || 0
    const rate  = Number(item.unitPrice) || 0
    return sum + (isSqFtUnit(item.unit) ? sqFt * rate : qty * rate)
  }, 0)

  const discount      = Number(watchedDiscount) || 0
  const paidAmount    = Number(watchedPaid)      || 0
  const finalAmount   = total - discount
  const balanceAmount = finalAmount - paidAmount

  async function onSubmit(values: FormValues) {
    const firstProduct = products.find((p) => p.id === values.items[0]?.productId)
    const section = firstProduct?.section ?? getUserSections(currentUser.id)[0]

    try {
      const bill = await api.bills.create({
        customerName:    values.customerName    || undefined,
        customerAddress: values.customerAddress || undefined,
        customerPhone:   values.customerPhone   || '',
        bookingDate:     values.bookingDate     || undefined,
        deliveryDate:    values.deliveryDate    || undefined,
        transport:       values.transport       || undefined,
        transportTime:   values.transportTime   || undefined,
        section,
        items: values.items.map((item) => ({
          productId:   item.productId,
          productName: item.productName,
          quantity:    item.quantity,
          unit:        item.unit,
          unitPrice:   item.unitPrice,
          glassSize:   item.glassSize  || undefined,
          model:       item.model      || undefined,
          sqFt:        item.sqFt > 0   ? item.sqFt : undefined,
        })),
        discount:   values.discount,
        paidAmount: values.paidAmount,
        createdBy:  currentUser.id,
      })
      toast.success(`Bill ${bill.billNumber} saved`)
      navigate(`/billing/${bill.id}`)
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        toast.error(`Not enough stock for ${err.productName}`)
      } else {
        toast.error('Failed to save bill')
      }
    }
  }

  function findScannedProduct(name: string) {
    const scan = tokenize(name)
    if (!scan.length) return undefined
    const scanSet = new Set(scan)

    let best: { product: (typeof products)[number]; score: number } | undefined
    for (const product of products) {
      const prod = tokenize(product.name)
      if (!prod.length) continue
      const prodSet = new Set(prod)

      const inter = [...scanSet].filter((t) => prodSet.has(t)).length
      if (!inter) continue
      const union = new Set([...scanSet, ...prodSet]).size
      const jaccard = inter / union
      // Order-insensitive: match on strong token overlap, OR when every scanned
      // token (2+) is present in the product (the scan doesn't contradict it).
      const scanFullyIn = scan.length >= 2 && scan.every((t) => prodSet.has(t))

      if ((jaccard >= 0.6 || scanFullyIn) && (!best || jaccard > best.score)) {
        best = { product, score: jaccard }
      }
    }
    return best?.product
  }

  function setScannedItem(index: number, item: ParsedBill['items'][number]) {
    const product = findScannedProduct(item.name)
    const isSqFtProduct = isSqFtUnit(product?.unit)

    form.setValue(`items.${index}.productId`, product?.id ?? '', { shouldValidate: true })
    form.setValue(`items.${index}.productName`, product?.name ?? item.name, { shouldValidate: true })
    form.setValue(`items.${index}.quantity`, item.qty, { shouldValidate: true })
    form.setValue(`items.${index}.unit`, product?.unit ?? 'pcs', { shouldValidate: true })
    form.setValue(`items.${index}.sqFt`, product ? (isSqFtProduct ? item.sqFt : 0) : item.sqFt, { shouldValidate: true })
    form.setValue(`items.${index}.unitPrice`, product?.salePrice ?? item.rate, { shouldValidate: true })
  }

  function handleBillExtract(parsed: ParsedBill) {
    form.setValue('customerName', parsed.customerName, { shouldValidate: true })
    form.setValue('customerPhone', parsed.customerPhone ?? '', { shouldValidate: true })
    form.setValue('customerAddress', parsed.customerAddress ?? '', { shouldValidate: true })

    const currentItems = form.getValues('items') ?? []
    const firstItem = currentItems[0]
    const canReuseFirstItem =
      currentItems.length === 1 &&
      !firstItem?.productId &&
      !firstItem?.productName &&
      Number(firstItem?.quantity ?? 1) === 1 &&
      Number(firstItem?.sqFt ?? 0) === 0 &&
      Number(firstItem?.unitPrice ?? 0) === 0

    const scannedItems = parsed.items.map((item) => {
      const product = findScannedProduct(item.name)
      const isSqFtProduct = isSqFtUnit(product?.unit)

      return {
        productId: product?.id ?? '',
        productName: product?.name ?? item.name,
        quantity: item.qty,
        unit: product?.unit ?? 'pcs',
        glassSize: '',
        model: '',
        sqFt: product ? (isSqFtProduct ? item.sqFt : 0) : item.sqFt,
        unitPrice: product?.salePrice ?? item.rate,
      }
    })

    if (canReuseFirstItem && parsed.items[0]) {
      setScannedItem(0, parsed.items[0])
      if (scannedItems.length > 1) append(scannedItems.slice(1), { shouldFocus: false })
    } else {
      append(scannedItems, { shouldFocus: false })
    }
  }

  function handleScanOpenChange(open: boolean) {
    setScanOpen(open)
    if (!open) setScannerImageDataUrl(undefined)
  }

  function openScannerConnection() {
    setScannerOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-heading">New bill</h1>
            <Button type="button" variant="outline" size="sm" onClick={() => setScanOpen(true)}>
              <ScanLine className="h-4 w-4 mr-2" />
              Scan the Bill
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openScannerConnection}>
              <ScanLine className="h-4 w-4 mr-2" />
              Scan from Scanner
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Items billed here reduce stock from your section.
          </p>
        </div>
      </div>

      <BillScanDialog
        open={scanOpen}
        onOpenChange={handleScanOpenChange}
        onExtract={handleBillExtract}
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Bill meta strip */}
          <div className="mb-6 flex justify-between items-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span>INV-{year}-DRAFT</span>
            <span>{todayLabel}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">

              {/* Customer card */}
              <Card className="bg-brand-raised">
                <CardHeader>
                  <CardTitle className="text-base">Customer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Name</Label>
                      <Input id="customerName" placeholder="Name" {...form.register('customerName')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone</Label>
                      <Input id="customerPhone" placeholder="+91 98765 43210" {...form.register('customerPhone')} />
                      {form.formState.errors.customerPhone && (
                        <p className="text-[0.8rem] font-medium text-destructive">
                          {form.formState.errors.customerPhone.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerAddress">Address</Label>
                    <Input id="customerAddress" placeholder="Address" {...form.register('customerAddress')} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bookingDate">Booking date</Label>
                      <Input id="bookingDate" type="date" {...form.register('bookingDate')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deliveryDate">Delivery date</Label>
                      <Input id="deliveryDate" type="date" {...form.register('deliveryDate')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="transport">Transport</Label>
                      <Input id="transport" placeholder="Vehicle / carrier" {...form.register('transport')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transportTime">Transport time</Label>
                      <Input id="transportTime" placeholder="e.g. 2 PM" {...form.register('transportTime')} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items card */}
              <Card className="bg-brand-raised">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Items</CardTitle>
                  <Button type="button" variant="ghost" size="sm" onClick={() => append(EMPTY_ITEM)}>
                    <Plus className="h-4 w-4 mr-1" /> Add item
                  </Button>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-0">
                  {fields.map((field, index) => (
                    <BillLineItem
                      key={field.id}
                      index={index}
                      isOnly={fields.length === 1}
                      onRemove={() => remove(index)}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => append(EMPTY_ITEM)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add item
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right column — sticky totals */}
            <div>
              <Card className="bg-brand-raised lg:sticky lg:top-6">
                <CardHeader>
                  <CardTitle className="text-base">Totals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono tabular-nums">{INR.format(total)}</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount">Discount (₹)</Label>
                    <Input
                      id="discount"
                      type="number"
                      min={0}
                      step="0.01"
                      className="font-mono tabular-nums text-right"
                      {...form.register('discount')}
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                    <span className="font-medium">Final Amount</span>
                    <span className="font-mono tabular-nums font-medium">{INR.format(finalAmount)}</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paidAmount">Paid Amount (₹)</Label>
                    <Input
                      id="paidAmount"
                      type="number"
                      min={0}
                      step="0.01"
                      className="font-mono tabular-nums text-right"
                      {...form.register('paidAmount')}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="font-medium">Balance</span>
                    <span className="text-2xl font-mono tabular-nums font-medium">
                      {INR.format(balanceAmount)}
                    </span>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={form.formState.isSubmitting}
                  >
                    Save bill
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Saving will reduce stock immediately.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}
