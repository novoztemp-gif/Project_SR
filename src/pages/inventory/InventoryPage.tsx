import * as React from 'react'
import { Download, Search } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GodownDetailSheet } from '@/components/inventory/GodownDetailSheet'
import { GodownGrid } from '@/components/inventory/GodownGrid'
import { StockLookupDialog } from '@/components/inventory/StockLookupDialog'
import { api } from '@/lib/api'
import { SECTIONS } from '@/lib/constants'
import { exportCsv } from '@/lib/exportCsv'
import { getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Godown, Product, Section } from '@/types'

function sectionLabel(section: Section) {
  return SECTIONS.find((item) => item.key === section)?.label ?? section
}

function productRows(products: Product[]) {
  return products.map((product) => [
    product.name,
    sectionLabel(product.section),
    product.sku,
    product.unit,
    product.salePrice ?? 'Not set',
    product.stock,
    product.lowStockThreshold,
    product.spec ?? '',
  ])
}

export function InventoryPage() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const products = useInventoryStore((s) => s.products)
  const godowns = useInventoryStore((s) => s.godowns)
  const allowedSections = currentUser ? getUserSections(currentUser.id) : []

  const accessibleSections = SECTIONS.filter(
    (s) => allowedSections.includes(s.key)
  )

  const [activeSection, setActiveSection] = React.useState<Section>(
    accessibleSections[0]?.key ?? 'glass_plywood'
  )
  const [openGodown, setOpenGodown] = React.useState<{
    godown: Godown
    section: Section
  } | null>(null)
  const [lookupOpen, setLookupOpen] = React.useState(false)
  const exportableProducts = products.filter(
    (product) => allowedSections.includes(product.section)
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setLookupOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock updates from purchase and sales bills only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              exportCsv(
                'inventory.csv',
                ['Name', 'Type', 'SKU', 'Unit', 'Price', 'Stock', 'Min Stock', 'Spec'],
                productRows(exportableProducts)
              )
              toast.success('Inventory exported')
            }}
          >
            <Download size={14} className="mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setLookupOpen(true)}
          >
            <Search size={14} className="mr-2" />
            Find product
            <kbd className="ml-2 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <Tabs
        value={activeSection}
        onValueChange={(v) => setActiveSection(v as Section)}
        className="mt-6"
      >
        <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0 border-b border-border gap-0">
          {accessibleSections.map((s) => {
            const isActive = activeSection === s.key
            const count = api.inventory.listBySection(s.key).length
            return (
              <TabsTrigger
                key={s.key}
                value={s.key}
                style={isActive ? { borderBottomColor: `hsl(var(${s.colorVar}))` } : undefined}
                className="rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 text-sm font-normal text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {s.label}
                <span className="ml-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {accessibleSections.map((s) => (
          <TabsContent key={s.key} value={s.key} className="mt-0">
            <GodownGrid
              section={s.key}
              onGodownClick={(godown) => setOpenGodown({ godown, section: s.key })}
            />
          </TabsContent>
        ))}
      </Tabs>

      <GodownDetailSheet
        open={!!openGodown}
        onOpenChange={(v) => { if (!v) setOpenGodown(null) }}
        godown={openGodown?.godown ?? null}
        section={openGodown?.section ?? null}
      />

      <StockLookupDialog
        open={lookupOpen}
        onOpenChange={setLookupOpen}
        onSelect={(product) => {
          setLookupOpen(false)
          const godown = godowns.find((g) => g.id === product.godownId)
          if (godown) setOpenGodown({ godown, section: product.section })
        }}
      />
    </div>
  )
}
