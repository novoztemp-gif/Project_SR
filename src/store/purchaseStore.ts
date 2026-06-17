import { create } from 'zustand'

import { http } from '@/lib/apiClient'
import { useInventoryStore } from '@/store/inventoryStore'
import type { PurchaseBill, Role, Section } from '@/types'

interface PurchaseDraft {
  vendorName: string
  date: string
  section: Section
  godownId: string
  imageUrl?: string
  items: PurchaseBill['items']
  createdBy: string
}

interface PurchaseState {
  purchases: PurchaseBill[]
  hydrated: boolean
  hydrate: () => Promise<void>
  addPurchase: (draft: PurchaseDraft) => Promise<string>
  getPurchase: (id: string) => PurchaseBill | undefined
  /** Backend already scopes /purchases to the user's sections, so this returns the cache. */
  getPurchasesForRole: (role: Role) => PurchaseBill[]
  applyAndPrint: (id: string) => Promise<void>
}

export const usePurchaseStore = create<PurchaseState>()((set, get) => ({
  purchases: [],
  hydrated: false,

  hydrate: async () => {
    const purchases = await http.get<PurchaseBill[]>('/purchases')
    set({ purchases, hydrated: true })
  },

  addPurchase: async (draft) => {
    const purchase = await http.post<PurchaseBill>('/purchases', {
      vendorName: draft.vendorName,
      date: draft.date,
      section: draft.section,
      godownId: draft.godownId,
      imageUrl: draft.imageUrl,
      items: draft.items,
    })
    set((state) => ({ purchases: [purchase, ...state.purchases] }))
    return purchase.id
  },

  getPurchase: (id) => get().purchases.find((purchase) => purchase.id === id),

  getPurchasesForRole: () => get().purchases,

  applyAndPrint: async (id) => {
    const updated = await http.post<PurchaseBill>(`/purchases/${id}/apply-print`)
    set((state) => ({
      purchases: state.purchases.map((purchase) => (purchase.id === id ? updated : purchase)),
    }))
    // Stock changed — refresh the inventory cache.
    await useInventoryStore.getState().refreshProducts()
  },
}))
