import * as React from 'react'
import { ArrowRightLeft, PackageSearch, Pencil, Plus, Trash2, Warehouse } from 'lucide-react'
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
import { SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Godown, Product, Section } from '@/types'
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
  const isAdmin = currentUser.role === 'admin'
  const products = useInventoryStore((state) => state.products)
  const godowns = useInventoryStore((state) => state.godowns)
  const transferStock = useInventoryStore((state) => state.transferStock)
  const addGodown = useInventoryStore((state) => state.addGodown)
  const updateGodown = useInventoryStore((state) => state.updateGodown)
  const deleteGodown = useInventoryStore((state) => state.deleteGodown)
  const allowedSections = getUserSections(currentUser.id)
  const [selectedGodownId, setSelectedGodownId] = React.useState(godowns[0]?.id ?? '')
  const [transferProduct, setTransferProduct] = React.useState<Product | null>(null)
  const [toGodownId, setToGodownId] = React.useState('')
  const [transferQty, setTransferQty] = React.useState(1)

  const [formMode, setFormMode] = React.useState<'add' | 'edit'>('add')
  const [editingGodown, setEditingGodown] = React.useState<Godown | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formName, setFormName] = React.useState('')
  const [formLocation, setFormLocation] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Godown | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    // Land on a real godown once the list loads, and follow along if the
    // currently-selected one gets deleted out from under it.
    if (!godowns.some((g) => g.id === selectedGodownId)) {
      setSelectedGodownId(godowns[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [godowns])

  const selectedGodown = godowns.find((godown) => godown.id === selectedGodownId) ?? godowns[0]
  const accessibleProducts = products.filter((product) => allowedSections.includes(product.section))
  const visibleProducts = accessibleProducts
    .filter((product) => product.godownId === selectedGodownId)
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name))

  function openTransfer(product: Product) {
    const firstDestination = godowns.find((godown) => godown.id !== product.godownId)?.id ?? ''
    setTransferProduct(product)
    setToGodownId(firstDestination)
    setTransferQty(Math.min(1, product.stock))
  }

  async function confirmTransfer() {
    if (!transferProduct) return
    const destination = godowns.find((godown) => godown.id === toGodownId)

    try {
      await transferStock(transferProduct.id, transferProduct.godownId, toGodownId, transferQty)
      toast.success(`Transferred ${transferQty} ${transferProduct.unit} of ${transferProduct.name} to ${destination?.name ?? toGodownId}`)
      setTransferProduct(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to transfer stock.')
    }
  }

  function openAddGodown() {
    setFormMode('add')
    setEditingGodown(null)
    setFormName('')
    setFormLocation('')
    setFormOpen(true)
  }

  function openEditGodown(godown: Godown) {
    setFormMode('edit')
    setEditingGodown(godown)
    setFormName(godown.name)
    setFormLocation(godown.location)
    setFormOpen(true)
  }

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = formName.trim()
    const location = formLocation.trim()
    if (!name || !location) {
      toast.error('Name and location are required')
      return
    }

    try {
      setSubmitting(true)
      if (formMode === 'edit' && editingGodown) {
        await updateGodown(editingGodown.id, { name, location })
        toast.success('Godown updated')
      } else {
        await addGodown({ name, location })
        toast.success('Godown added')
      }
      setFormOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save godown')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDeleteGodown() {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await deleteGodown(deleteTarget.id)
      toast.success('Godown removed')
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove godown')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-heading">Godowns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Godown-wise stock across your accessible product types.
          </p>
        </div>
        {isAdmin && (
          <Button type="button" size="sm" onClick={openAddGodown}>
            <Plus className="mr-2 h-4 w-4" />
            Add Godown
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {godowns.map((godown) => {
            const godownProducts = accessibleProducts.filter((product) => product.godownId === godown.id)
            const lowCount = godownProducts.filter(isLowStock).length
            const isSelected = godown.id === selectedGodownId

            return (
              <div
                key={godown.id}
                className={cn(
                  'w-full rounded-xl border border-border bg-card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-brand-mid hover:bg-muted',
                  isSelected && 'border-brand-mid glow-brand'
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedGodownId(godown.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{godown.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{godown.location}</p>
                    </div>
                    <Warehouse className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{godownProducts.length} products</span>
                    {lowCount > 0 && <Badge variant="destructive">{lowCount} low</Badge>}
                  </div>
                </button>
                {isAdmin && (
                  <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => openEditGodown(godown)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDeleteTarget(godown)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            )
          })}

          {godowns.length === 0 && (
            <EmptyState
              icon={Warehouse}
              title="No godowns yet"
              message={isAdmin ? 'Add a godown to start assigning stock to it.' : 'No godowns have been set up yet.'}
            />
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{selectedGodown?.name ?? '—'}</CardTitle>
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={product.stock < 1}
                          onClick={() => openTransfer(product)}
                        >
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
                  <Input readOnly value={godowns.find((godown) => godown.id === transferProduct.godownId)?.name ?? transferProduct.godownId} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>To Godown</Label>
                <Select value={toGodownId} onValueChange={setToGodownId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {godowns.filter((godown) => godown.id !== transferProduct.godownId).map((godown) => (
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
                  // Guard against a self-contradictory min > max: at 0 stock
                  // (data drift, a just-sold-out item, etc.) max={0} would
                  // silently make this field permanently invalid.
                  max={transferProduct.stock >= 1 ? transferProduct.stock : undefined}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formMode === 'add' ? 'Add godown' : 'Edit godown'}</DialogTitle>
            <DialogDescription>
              {formMode === 'add' ? 'Create a new place to hold stock.' : 'Rename or relocate this godown.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="godownName">Name</Label>
              <Input id="godownName" value={formName} onChange={(event) => setFormName(event.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="godownLocation">Location</Label>
              <Input id="godownLocation" value={formLocation} onChange={(event) => setFormLocation(event.target.value)} required />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : formMode === 'add' ? 'Create godown' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove godown?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} will be permanently removed. This only works while the godown holds no
              products — transfer everything out first if it does.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteGodown} disabled={deleting}>
              {deleting ? 'Removing…' : 'Remove godown'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
