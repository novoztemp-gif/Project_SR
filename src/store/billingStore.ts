import { create } from 'zustand'

import { http } from '@/lib/apiClient'
import type { SalesBill } from '@/types'

interface BillingState {
  bills: SalesBill[]
  hydrated: boolean
  hydrate: () => Promise<void>
  /** Insert a freshly-created bill (from api.bills.create) into the cache. */
  addBillToCache: (bill: SalesBill) => void

  // Synchronous getters over the cache.
  getBillById: (id: string) => SalesBill | undefined
  getBillsByDateRange: (start: string, end: string) => SalesBill[]
  getTodaysBills: (userId?: string) => SalesBill[]
  getBillsByUser: (userId: string) => SalesBill[]
}

export const useBillingStore = create<BillingState>()((set, get) => ({
  bills: [],
  hydrated: false,

  hydrate: async () => {
    const bills = await http.get<SalesBill[]>('/bills')
    set({ bills, hydrated: true })
  },

  addBillToCache: (bill) => set((state) => ({ bills: [bill, ...state.bills] })),

  getBillById: (id) => get().bills.find((b) => b.id === id),

  getBillsByDateRange: (start, end) => {
    const s = new Date(start).getTime()
    const e = new Date(end).getTime()
    return get().bills.filter((b) => {
      const t = new Date(b.date).getTime()
      return t >= s && t <= e
    })
  },

  getTodaysBills: (userId) => {
    const today = new Date().toDateString()
    return get().bills.filter((b) => {
      const sameDay = new Date(b.date).toDateString() === today
      return sameDay && (userId === undefined || b.createdBy === userId)
    })
  },

  getBillsByUser: (userId) => get().bills.filter((b) => b.createdBy === userId),
}))
