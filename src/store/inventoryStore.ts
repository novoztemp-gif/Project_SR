import { create } from 'zustand'

import { http } from '@/lib/apiClient'
import type { Godown, Product, Section, TransferLogEntry } from '@/types'

export interface ProductDefinitionInput {
  name: string
  spec?: string
  sku: string
  unit: string
  salePrice: number
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
      transferLog = []
    }
    set({ products, godowns, transferLog, hydrated: true })
  },

  refreshProducts: async () => {
    const products = await http.get<Product[]>('/inventory/products')
    set({ products })
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
}))
