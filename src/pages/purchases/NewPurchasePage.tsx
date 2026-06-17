import * as React from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, ImageIcon, Plus, Ruler, ScanLine, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { MeasurementsDialog } from '@/components/billing/MeasurementsDialog'
import { ScannerConnectDialog } from '@/components/billing/ScannerConnectDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GODOWNS_SEED, SECTIONS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { usePurchaseStore } from '@/store/purchaseStore'
import type { Section } from '@/types'

const UNITS = ['pcs', 'box', 'sheet', 'length', 'tin', 'bag', 'roll', 'set', 'pair', 'kg']
const NEW_PRODUCT_VALUE = '__new__'
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

const itemSchema = z.object({
  productId: z.string(),
  productName: z.string().min(1, 'Item name is required'),
  sizeDimension: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Min 1'),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.coerce.number().min(0, 'Must be 0 or more'),
  subtotal: z.number().default(0),
})

const formSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  date: z.string().min(1),
  section: z.custom<Section>((value) => typeof value === 'string' && SECTIONS.some((section) => section.key === value)),
  godownId: z.string().min(1, 'Select a godown'),
  imageUrl: z.string().optional(),
  items: z.array(itemSchema).min(1),
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
  subtotal: 0,
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
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [scanOpen, setScanOpen] = React.useState(false)
  const [scannerOpen, setScannerOpen] = React.useState(false)
  const [measurementsIndex, setMeasurementsIndex] = React.useState<number | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorName: '',
      date: todayInputValue(),
      section: allowedSections[0],
      godownId: GODOWNS_SEED[0]?.id ?? '',
      imageUrl: undefined,
      items: [EMPTY_ITEM],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchedSection = useWatch({ control: form.control, name: 'section' }) as Section
  const watchedGodownId = useWatch({ control: form.control, name: 'godownId' })
  const watchedItems = useWatch({ control: form.control, name: 'items' })
  const imageUrl = useWatch({ control: form.control, name: 'imageUrl' })

  const accessibleProducts = products.filter((product) => allowedSections.includes(product.section))
  const total = (watchedItems ?? []).reduce(
    (sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0),
    0
  )

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  React.useEffect(() => {
    if (!scanOpen) {
      stopCamera()
      return
    }

    let cancelled = false

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Camera access denied. Please use Upload instead.')
        setScanOpen(false)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        toast.error('Camera access denied. Please use Upload instead.')
        setScanOpen(false)
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [scanOpen, stopCamera])

  React.useEffect(() => {
    const state = location.state as { restockProductId?: string } | null
    if (!state?.restockProductId) return

    const product = products.find((item) => item.id === state.restockProductId)
    if (!product || !allowedSections.includes(product.section)) return

    form.setValue('section', product.section, { shouldValidate: true })
    form.setValue('godownId', product.godownId, { shouldValidate: true })
    form.setValue('items', [{
      productId: product.id,
      productName: product.name,
      sizeDimension: '',
      quantity: 1,
      unit: product.unit,
      unitPrice: product.costPrice,
      subtotal: 0,
    }], { shouldValidate: true })
    navigate(location.pathname, { replace: true, state: null })
  }, [allowedSections, form, location.pathname, location.state, navigate, products])

  function selectProduct(index: number, value: string) {
    if (value === NEW_PRODUCT_VALUE) {
      form.setValue(`items.${index}.productId`, '', { shouldValidate: true })
      form.setValue(`items.${index}.productName`, '', { shouldValidate: true })
      form.setValue(`items.${index}.unit`, 'pcs')
      form.setValue(`items.${index}.unitPrice`, 0)
      return
    }

    const product = products.find((item) => item.id === value)
    if (!product) return
    form.setValue('section', product.section, { shouldValidate: true })
    form.setValue('godownId', product.godownId, { shouldValidate: true })
    form.setValue(`items.${index}.productId`, product.id, { shouldValidate: true })
    form.setValue(`items.${index}.productName`, product.name, { shouldValidate: true })
    form.setValue(`items.${index}.unit`, product.unit, { shouldValidate: true })
    form.setValue(`items.${index}.unitPrice`, product.costPrice, { shouldValidate: true })
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        form.setValue('imageUrl', reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleScanOpenChange(open: boolean) {
    if (!open) stopCamera()
    setScanOpen(open)
  }

  function captureImage() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    form.setValue('imageUrl', canvas.toDataURL('image/jpeg', 0.9))
    stopCamera()
    setScanOpen(false)
  }

  async function onSubmit(values: FormValues) {
    try {
      const id = await addPurchase({
        vendorName: values.vendorName,
        date: new Date(values.date).toISOString(),
        section: values.section,
        godownId: values.godownId,
        imageUrl: values.imageUrl,
        items: values.items.map((item) => ({
          ...item,
          subtotal: item.quantity * item.unitPrice,
        })),
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

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
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
                  onValueChange={(value) => {
                    form.setValue('section', value as Section, { shouldValidate: true })
                    form.setValue('items', [EMPTY_ITEM])
                  }}
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

              <div className="space-y-2">
                <Label>Godown</Label>
                <Select
                  value={watchedGodownId}
                  onValueChange={(value) => form.setValue('godownId', value, { shouldValidate: true })}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reference photo</CardTitle>
            </CardHeader>
            <CardContent>
              {imageUrl ? (
                <div className="flex items-center gap-3">
                  <img src={imageUrl} alt="Purchase reference" className="h-20 w-20 rounded-md border border-border object-cover" />
                  <Button type="button" variant="outline" size="sm" onClick={() => form.setValue('imageUrl', undefined)}>
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                    <span>Upload photo</span>
                    <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto justify-start gap-3 px-4 py-5 text-sm font-normal text-muted-foreground"
                    onClick={() => setScanOpen(true)}
                  >
                    <Camera className="h-5 w-5" />
                    Scan image (camera)
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
                  <div key={field.id} className="grid gap-3 border-b border-border pb-4 last:border-0 sm:grid-cols-[1.4fr_1fr_0.7fr_0.8fr_0.8fr_auto]">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <Select value={item?.productId || NEW_PRODUCT_VALUE} onValueChange={(value) => selectProduct(index, value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NEW_PRODUCT_VALUE}>+ New product</SelectItem>
                          {accessibleProducts.map((product) => {
                            const sectionLabel = SECTIONS.find((section) => section.key === product.section)?.label ?? product.section
                            return (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({sectionLabel})
                            </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
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
                      <Input type="number" min={1} className="font-mono tabular-nums" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} />
                    </div>

                    <div className="space-y-2">
                      <Label>Unit price</Label>
                      <Input type="number" min={0} className="font-mono tabular-nums" {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
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
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">Total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-muted-foreground">Running total</span>
              <span className="font-mono text-2xl font-medium tabular-nums">{INR.format(total)}</span>
            </div>
            <Button type="submit" className="w-full" size="lg">
              Save purchase
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Stock remains pending until print.
            </p>
          </CardContent>
        </Card>
      </form>

      <Dialog open={scanOpen} onOpenChange={handleScanOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan image</DialogTitle>
          </DialogHeader>
          <video
            ref={videoRef}
            className="aspect-video w-full rounded-md border border-border bg-muted object-cover"
            muted
            playsInline
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleScanOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={captureImage}>
              Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScannerConnectDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onImageScanned={(imageDataUrl) => form.setValue('imageUrl', imageDataUrl, { shouldValidate: true })}
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
