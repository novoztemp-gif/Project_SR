// Data-access seam. Reads are synchronous against the hydrated Zustand caches
// (the stores are populated from the backend on bootstrap). Mutations that
// change server state (bill creation) go through the HTTP client.

import { ApiClientError, http } from '@/lib/apiClient'
import { useInventoryStore } from '@/store/inventoryStore'
import { useBillingStore } from '@/store/billingStore'
import type { CreateBillInput, SalesBill, Section } from '@/types'

export class InsufficientStockError extends Error {
  readonly productName: string
  readonly available: number
  readonly requested: number

  constructor(productName: string, available: number, requested: number) {
    super(`Not enough stock for ${productName}`)
    this.name = 'InsufficientStockError'
    this.productName = productName
    this.available = available
    this.requested = requested
  }
}

export const api = {
  inventory: {
    listBySection(section: Section) {
      return useInventoryStore.getState().getBySection(section)
    },
    listByGodown(godownId: string, section?: Section) {
      return useInventoryStore.getState().getByGodown(godownId, section)
    },
    search(query: string, allowedSections: Section[]) {
      return useInventoryStore.getState().searchProducts(query, allowedSections)
    },
    godownsForSection(section: Section) {
      return useInventoryStore.getState().getGodownsForSection(section)
    },
  },

  bills: {
    /** Create a bill on the backend (atomic stock decrement) and update caches. */
    async create(input: CreateBillInput): Promise<SalesBill> {
      try {
        const bill = await http.post<SalesBill>('/bills', {
          customerName: input.customerName,
          customerAddress: input.customerAddress,
          customerPhone: input.customerPhone ?? '',
          bookingDate: input.bookingDate,
          deliveryDate: input.deliveryDate,
          transport: input.transport,
          transportTime: input.transportTime,
          section: input.section,
          items: input.items,
          discount: input.discount ?? 0,
          paidAmount: input.paidAmount ?? 0,
        })
        useBillingStore.getState().addBillToCache(bill)
        // Stock changed — refresh the inventory cache.
        await useInventoryStore.getState().refreshProducts()
        return bill
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 409) {
          const d = err.details as
            | { productName?: string; available?: number; requested?: number }
            | undefined
          throw new InsufficientStockError(
            d?.productName ?? 'item',
            d?.available ?? 0,
            d?.requested ?? 0,
          )
        }
        throw err
      }
    },

    list({
      from,
      to,
      section,
      sections,
      userId,
    }: {
      from?: string
      to?: string
      section?: Section
      sections?: Section[]
      userId?: string
    } = {}): SalesBill[] {
      const store = useBillingStore.getState()
      let bills = from && to ? store.getBillsByDateRange(from, to) : store.bills
      if (sections?.length) bills = bills.filter((b) => sections.includes(b.section))
      else if (section) bills = bills.filter((b) => b.section === section)
      if (userId) bills = bills.filter((b) => b.createdBy === userId)
      return bills
    },

    get(id: string, allowedSections?: Section[]): SalesBill | undefined {
      const bill = useBillingStore.getState().getBillById(id)
      if (!bill) return undefined
      if (allowedSections && !allowedSections.includes(bill.section)) return undefined
      return bill
    },

    today(userId?: string): SalesBill[] {
      return useBillingStore.getState().getTodaysBills(userId)
    },
  },
} as const
