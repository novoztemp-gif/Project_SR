import * as React from 'react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { api } from '@/lib/api'
import { SECTIONS } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { getUserSections } from '@/lib/userSections'
import type { Product } from '@/types'

interface StockLookupDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSelect: (product: Product) => void
}

export function StockLookupDialog({ open, onOpenChange, onSelect }: StockLookupDialogProps) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const godowns = useInventoryStore((s) => s.godowns)
  const [query, setQuery] = React.useState('')

  const allowedSections = currentUser ? getUserSections(currentUser.id) : []
  const results = api.inventory.search(query, allowedSections)

  const grouped = allowedSections
    .map((key) => ({
      key,
      label: SECTIONS.find((s) => s.key === key)?.label ?? key,
      products: results.filter((p) => p.section === key),
    }))
    .filter((g) => g.products.length > 0)

  const godownName = Object.fromEntries(godowns.map((g) => [g.id, g.name]))

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setQuery('')
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-lg gap-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search products by name..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No products found</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup key={group.key} heading={group.label}>
                {group.products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => onSelect(product)}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{product.name}</span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums ml-4 shrink-0">
                      {product.stock} {product.unit} - {godownName[product.godownId]}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
