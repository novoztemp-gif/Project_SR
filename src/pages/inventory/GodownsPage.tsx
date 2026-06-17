import * as React from 'react'
import { ArrowRightLeft, PackageSearch, Warehouse } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { GODOWNS_SEED, SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Product, Section } from '@/types'
import { cn } from '@/lib/utils'

function sectionLabel(section: Section) {
  return SECTIONS.find((item) => item.key === section)?.label ?? section
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

function isLowStock(product: Product) {
  return product.stock <= product.lowStockThreshold
}

export function GodownsPage() {
  const currentUser = useAuthStore((state) => state.currentUser)!
  const products = useInventoryStore((state) => state.products)
  const transferStock = useInventoryStore((state) => state.transferStock)
  const allowedSections = getUserSections(currentUser.id)
  const [selectedGodownId, setSelectedGodownId] = React.useState(GODOWNS_SEED[0]?.id ?? '')
  const [transferProduct, setTransferProduct] = React.useState<Product | null>(null)
  const [toGodownId, setToGodownId] = React.useState('')
  const [transferQty, setTransferQty] = React.useState(1)

  const selectedGodown = GODOWNS_SEED.find((godown) => godown.id === selectedGodownId) ?? GODOWNS_SEED[0]
  const accessibleProducts = products.filter((product) => allowedSections.includes(product.section))
  const visibleProducts = accessibleProducts
    .filter((product) => product.godownId === selectedGodownId)
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name))

  function openTransfer(product: Product) {
    const firstDestination = GODOWNS_SEED.find((godown) => godown.id !== product.godownId)?.id ?? ''
    setTransferProduct(product)
    setToGodownId(firstDestination)
    setTransferQty(Math.min(1, product.stock))
  }

  async function confirmTransfer() {
    if (!transferProduct) return
    const destination = GODOWNS_SEED.find((godown) => godown.id === toGodownId)

    try {
      await transferStock(transferProduct.id, transferProduct.godownId, toGodownId, transferQty)
      toast.success(`Transferred ${transferQty} ${transferProduct.unit} of ${transferProduct.name} to ${destination?.name ?? toGodownId}`)
      setTransferProduct(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to transfer stock.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-heading">Godowns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Godown-wise stock across your accessible product types.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {GODOWNS_SEED.map((godown) => {
            const godownProducts = accessibleProducts.filter((product) => product.godownId === godown.id)
            const lowCount = godownProducts.filter(isLowStock).length
            const isSelected = godown.id === selectedGodownId

            return (
              <button
                key={godown.id}
                type="button"
                onClick={() => setSelectedGodownId(godown.id)}
                className={cn(
                  'w-full rounded-xl border border-border bg-card p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand-mid hover:bg-muted',
                  isSelected && 'border-brand-mid glow-brand'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{godown.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{godown.location}</p>
                  </div>
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{godownProducts.length} products</span>
                  {lowCount > 0 && <Badge variant="destructive">{lowCount} low</Badge>}
                </div>
              </button>
            )
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{selectedGodown?.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{selectedGodown?.location}</p>
              </div>
              <Badge variant="outline">{visibleProducts.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {visibleProducts.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="No products in this godown"
                message="Accessible stock for this godown will appear here once products are assigned."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        {product.spec && <div className="text-xs text-muted-foreground">{product.spec}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" style={sectionBadgeStyle(product.section)}>{sectionLabel(product.section)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {product.stock} {product.unit}
                      </TableCell>
                      <TableCell>
                        {isLowStock(product) ? (
                          <Badge variant="destructive">Low stock</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => openTransfer(product)}>
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          Transfer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!transferProduct} onOpenChange={(open) => { if (!open) setTransferProduct(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer stock</DialogTitle>
            <DialogDescription>
              Move this product to another godown without changing total stock.
            </DialogDescription>
          </DialogHeader>

          {transferProduct && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Input readOnly value={transferProduct.name} />
                </div>
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input readOnly value={GODOWNS_SEED.find((godown) => godown.id === transferProduct.godownId)?.name ?? transferProduct.godownId} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>To Godown</Label>
                <Select value={toGodownId} onValueChange={setToGodownId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GODOWNS_SEED.filter((godown) => godown.id !== transferProduct.godownId).map((godown) => (
                      <SelectItem key={godown.id} value={godown.id}>
                        {godown.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transferQty">Qty</Label>
                <Input
                  id="transferQty"
                  type="number"
                  min={1}
                  max={transferProduct.stock}
                  value={transferQty}
                  onChange={(event) => setTransferQty(Number(event.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Available: {transferProduct.stock} {transferProduct.unit}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransferProduct(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmTransfer}>
              Confirm transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
