import { create } from 'zustand'

import { http } from '@/lib/apiClient'
import type { Godown, Product, Section, TransferLogEntry } from '@/types'

export interface GodownInput {
  name: string
  location: string
}

export interface ProductDefinitionInput {
  name: string
  spec?: string
  sku: string
  unit: string
  costPrice?: number
  /** null = leave/reset the selling price unset. */
  salePrice: number | null
  section: Section
  godownId: string
  lowStockThreshold: number
  /** Opening stock for the new product (create only; ignored on update). */
  openingStock?: number
}

interface InventoryState {
  products: Product[]
  godowns: Godown[]
  transferLog: TransferLogEntry[]
  hydrated: boolean

  hydrate: () => Promise<void>
  /** Re-fetch products only (after a bill or purchase changes stock). */
  refreshProducts: () => Promise<void>
  /** Re-fetch products + godowns — used for background polling so one
   * user's changes (new product, restock, new godown) show up for every
   * other already-open session, not just the tab that made the change. */
  refreshInventory: () => Promise<void>

  // ── Synchronous getters (read the hydrated cache) ──────────────────────────
  getBySection: (section: Section) => Product[]
  getByGodown: (godownId: string, section?: Section) => Product[]
  getGodownsForSection: (section: Section) => Godown[]
  getProductCount: (section: Section, godownId: string) => number
  getLowStockCount: (section: Section, godownId: string) => number
  searchProducts: (query: string, allowedSections: Section[]) => Product[]

  // ── Async write-through mutations ──────────────────────────────────────────
  addProductDefinition: (input: ProductDefinitionInput) => Promise<Product>
  updateProductDefinition: (productId: string, input: ProductDefinitionInput) => Promise<void>
  deleteProduct: (productId: string) => Promise<void>
  transferStock: (
    productId: string,
    fromGodownId: string,
    toGodownId: string,
    qty: number,
  ) => Promise<void>
  addGodown: (input: GodownInput) => Promise<Godown>
  updateGodown: (godownId: string, input: GodownInput) => Promise<void>
  deleteGodown: (godownId: string) => Promise<void>
}

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  products: [],
  godowns: [],
  transferLog: [],
  hydrated: false,

  hydrate: async () => {
    const [products, godowns] = await Promise.all([
      http.get<Product[]>('/inventory/products'),
      http.get<Godown[]>('/inventory/godowns'),
    ])
    // Transfer log is admin-only; ignore a 403 for billing users.
    let transferLog: TransferLogEntry[] = []
    try {
      transferLog = await http.get<TransferLogEntry[]>('/inventory/transfers')
    } catch {
      // transferLog already defaults to []
    }
    set({ products, godowns, transferLog, hydrated: true })
  },

  refreshProducts: async () => {
    const products = await http.get<Product[]>('/inventory/products')
    set({ products })
  },

  refreshInventory: async () => {
    const [products, godowns] = await Promise.all([
      http.get<Product[]>('/inventory/products'),
      http.get<Godown[]>('/inventory/godowns'),
    ])
    set({ products, godowns })
  },

  getBySection: (section) => get().products.filter((p) => p.section === section),

  getByGodown: (godownId, section) =>
    get().products.filter(
      (p) => p.godownId === godownId && (section === undefined || p.section === section),
    ),

  getGodownsForSection: (section) => {
    const ids = new Set(
      get().products.filter((p) => p.section === section).map((p) => p.godownId),
    )
    return get().godowns.filter((g) => ids.has(g.id))
  },

  getProductCount: (section, godownId) =>
    get().products.filter((p) => p.section === section && p.godownId === godownId).length,

  getLowStockCount: (section, godownId) =>
    get().products.filter(
      (p) => p.section === section && p.godownId === godownId && p.stock <= p.lowStockThreshold,
    ).length,

  searchProducts: (query, allowedSections) => {
    const q = query.toLowerCase()
    return get().products.filter(
      (p) =>
        allowedSections.includes(p.section) &&
        `${p.name} ${p.sku} ${p.spec ?? ''}`.toLowerCase().includes(q),
    )
  },

  addProductDefinition: async (input) => {
    const product = await http.post<Product>('/inventory/products', input)
    set((state) => ({ products: [...state.products, product] }))
    return product
  },

  updateProductDefinition: async (productId, input) => {
    const product = await http.put<Product>(`/inventory/products/${productId}`, input)
    set((state) => ({
      products: state.products.map((p) => (p.id === productId ? product : p)),
    }))
  },

  deleteProduct: async (productId) => {
    await http.del(`/inventory/products/${productId}`)
    set((state) => ({ products: state.products.filter((p) => p.id !== productId) }))
  },

  transferStock: async (productId, fromGodownId, toGodownId, qty) => {
    const entry = await http.post<TransferLogEntry>('/inventory/transfers', {
      productId,
      fromGodownId,
      toGodownId,
      qty,
    })
    // The product's godown changed — refresh products and prepend the log entry.
    await get().refreshProducts()
    set((state) => ({ transferLog: [entry, ...state.transferLog] }))
  },

  addGodown: async (input) => {
    const godown = await http.post<Godown>('/inventory/godowns', input)
    set((state) => ({ godowns: [...state.godowns, godown] }))
    return godown
  },

  updateGodown: async (godownId, input) => {
    const godown = await http.put<Godown>(`/inventory/godowns/${godownId}`, input)
    set((state) => ({
      godowns: state.godowns.map((g) => (g.id === godownId ? godown : g)),
    }))
  },

  deleteGodown: async (godownId) => {
    await http.del(`/inventory/godowns/${godownId}`)
    set((state) => ({ godowns: state.godowns.filter((g) => g.id !== godownId) }))
  },
}))
