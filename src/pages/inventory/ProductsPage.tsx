import * as React from 'react'
import { AlertTriangle, Download, PackagePlus, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProductFormDialog, type ProductFormValues } from '@/components/inventory/ProductFormDialog'
import { exportCsv } from '@/lib/exportCsv'
import { GODOWNS_SEED, SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Product, Section } from '@/types'
import { cn } from '@/lib/utils'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const ALL_TYPES = '__all__'

function sectionLabel(section: Section) {
  return SECTIONS.find((item) => item.key === section)?.label ?? section
}

function godownName(godownId: string) {
  return GODOWNS_SEED.find((godown) => godown.id === godownId)?.name ?? godownId
}

function sectionBadgeStyle(section: Section) {
  const label = sectionLabel(section)
  const color = SECTION_COLORS[label] ?? '#5F9598'
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}40`,
    color,
  }
}

function stockTone(product: Product) {
  if (product.stock <= 0 || product.stock < product.lowStockThreshold * 0.5) return 'red'
  if (product.stock <= product.lowStockThreshold) return 'warn'
  return 'green'
}

function stockBarClass(product: Product) {
  const tone = stockTone(product)
  if (tone === 'green') return 'bg-[#4CAF50]'
  if (tone === 'warn') return 'bg-[#FFB74D]'
  return 'bg-[#EF5350]'
}

function stockRatio(product: Product) {
  if (product.lowStockThreshold <= 0) return 100
  return Math.min((product.stock / product.lowStockThreshold) * 100, 100)
}

function isLowStock(product: Product) {
  return product.stock <= product.lowStockThreshold
}

function productRows(products: Product[]) {
  return products.map((product) => [
    product.name,
    sectionLabel(product.section),
    product.sku,
    product.unit,
    product.salePrice,
    product.stock,
    product.lowStockThreshold,
    product.spec ?? '',
  ])
}

export function ProductsPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)!
  const products = useInventoryStore((state) => state.products)
  const addProductDefinition = useInventoryStore((state) => state.addProductDefinition)
  const updateProductDefinition = useInventoryStore((state) => state.updateProductDefinition)
  const deleteProduct = useInventoryStore((state) => state.deleteProduct)
  const allowedSections = getUserSections(currentUser.id)
  const accessibleTypes = SECTIONS.filter((section) => allowedSections.includes(section.key))

  const [query, setQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<string>(ALL_TYPES)
  const [dialogMode, setDialogMode] = React.useState<'add' | 'edit'>('add')
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formKey, setFormKey] = React.useState(0)
  const [deleteTarget, setDeleteTarget] = React.useState<Product | null>(null)

  const filteredProducts = products
    .filter((product) => allowedSections.includes(product.section))
    .filter((product) => typeFilter === ALL_TYPES || product.section === typeFilter)
    .filter((product) => `${product.name} ${product.sku} ${product.spec ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  function openAddDialog() {
    setDialogMode('add')
    setEditingProduct(null)
    setFormKey((key) => key + 1)
    setFormOpen(true)
  }

  function openEditDialog(product: Product) {
    setDialogMode('edit')
    setEditingProduct(product)
    setFormKey((key) => key + 1)
    setFormOpen(true)
  }

  async function handleSubmit(values: ProductFormValues) {
    if (!values.name || !values.sku || !values.unit) {
      toast.error('Name, SKU, and unit are required')
      return
    }

    try {
      if (dialogMode === 'edit' && editingProduct) {
        await updateProductDefinition(editingProduct.id, values)
        toast.success('Product updated')
      } else {
        await addProductDefinition(values)
        toast.success('Product added at stock 0')
      }
      setFormOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save product')
    }
  }

  function requestDelete(product: Product) {
    const matchingBills = api.bills.list().filter((bill) =>
      bill.items.some((item) => item.productId === product.id)
    )

    if (matchingBills.length > 0) {
      toast.error(
        `${product.name} appears on ${matchingBills.length} existing bill${matchingBills.length === 1 ? '' : 's'} and cannot be deleted.`
      )
      return
    }

    setDeleteTarget(product)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteProduct(deleteTarget.id)
      toast.success('Product deleted')
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete product')
    }
  }

  function exportProducts() {
    exportCsv(
      'products.csv',
      ['Name', 'Type', 'SKU', 'Unit', 'Price', 'Stock', 'Min Stock', 'Spec'],
      productRows(filteredProducts)
    )
    toast.success('Products exported')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-heading">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Total: {filteredProducts.length} items</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>All Types</SelectItem>
              {accessibleTypes.map((section) => (
                <SelectItem key={section.key} value={section.key}>
                  {section.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={exportProducts}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map((product) => {
          const ratio = stockRatio(product)
          const lowStock = isLowStock(product)
          return (
            <Card key={product.id} className="overflow-hidden border-border bg-card transition duration-200 hover:-translate-y-0.5 hover:border-brand-mid">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="outline" style={sectionBadgeStyle(product.section)}>{sectionLabel(product.section)}</Badge>
                  <span className="max-w-[55%] truncate text-right text-xs text-muted-foreground">
                    {product.spec || godownName(product.godownId)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-medium">{product.name}</h2>
                    {lowStock && <AlertTriangle className="h-4 w-4 shrink-0 text-[#EF5350]" />}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Stock</p>
                    <p className={cn('mt-1 font-mono text-lg font-medium tabular-nums', lowStock && 'text-[#EF5350]')}>
                      {product.stock} <span className="text-xs text-muted-foreground">{product.unit}</span>
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="mt-1 font-mono text-lg font-medium tabular-nums">{INR.format(product.salePrice)}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Stock level</span>
                    <span className="font-mono tabular-nums">
                      {product.stock}/{product.lowStockThreshold}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', stockBarClass(product))} style={{ width: `${ratio}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEditDialog(product)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/purchases/new', { state: { restockProductId: product.id } })}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restock
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => requestDelete(product)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredProducts.length === 0 && (
        <EmptyState
          icon={PackagePlus}
          title="No products match"
          message="Adjust the search or type filter to see more product definitions."
        />
      )}

      <ProductFormDialog
        key={formKey}
        open={formOpen}
        mode={dialogMode}
        product={editingProduct}
        allowedSections={allowedSections}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>
              This removes the product definition. Existing bill history is checked before this dialog opens.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Delete <span className="font-medium">{deleteTarget?.name}</span>?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
