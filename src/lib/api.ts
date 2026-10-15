// Data-access seam. Reads are synchronous against the hydrated Zustand caches
// (the stores are populated from the backend on bootstrap). Mutations that
// change server state (bill creation) go through the HTTP client.

import { ApiClientError, http } from '@/lib/apiClient'
import { useInventoryStore } from '@/store/inventoryStore'
import { useBillingStore } from '@/store/billingStore'
import { usePurchaseStore } from '@/store/purchaseStore'
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
          deliveryTime: input.deliveryTime,
          transport: input.transport,
          transportTime: input.transportTime,
          writtenStaff: input.writtenStaff,
          priority: input.priority,
          orderNumber: input.orderNumber,
          jobDescription: input.jobDescription,
          section: input.section,
          items: input.items,
          transportationAmount: input.transportationAmount ?? 0,
          cuttingCharge: input.cuttingCharge ?? 0,
          discount: input.discount ?? 0,
          paidAmount: input.paidAmount ?? 0,
          billType: input.billType ?? 'general',
        })
        useBillingStore.getState().addBillToCache(bill)
        // Stock changed — refresh the inventory cache.
        await useInventoryStore.getState().refreshProducts()
        return bill
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 409) {
          // The rejection itself means another counter's sale already
          // moved this stock out from under the cached number this form
          // was showing — refresh so the counter immediately sees the
          // real (lower) stock explaining the error, instead of staring
          // at a now-wrong figure until the next poll tick.
          await useInventoryStore.getState().refreshProducts()
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

    /** Update how much of a bill has been paid; server recomputes status. */
    async updatePayment(id: string, paidAmount: number): Promise<SalesBill> {
      const bill = await http.patch<SalesBill>(`/bills/${id}/payment`, { paidAmount })
      useBillingStore.getState().updateBillInCache(bill)
      return bill
    },

    /**
     * Permanently delete a bill (admin only) — the server restores the
     * stock it had deducted, so the inventory cache is refreshed too.
     */
    async remove(id: string): Promise<void> {
      await http.del(`/bills/${id}`)
      useBillingStore.getState().removeBillFromCache(id)
      await useInventoryStore.getState().refreshProducts()
    },
  },

  admin: {
    /**
     * Permanently wipes every bill, purchase, transfer log entry, and
     * product (admin only) — Godowns and counter accounts are untouched.
     * Irreversible. Clears the matching client-side caches directly
     * (not a re-hydrate) since the server just confirmed they're empty.
     */
    async resetAllData(): Promise<{ bills: number; purchases: number; transfers: number; products: number }> {
      const { deleted } = await http.post<{ ok: true; deleted: { bills: number; purchases: number; transfers: number; products: number } }>(
        '/admin/reset',
        { confirm: 'ERASE ALL DATA' },
      )
      useBillingStore.setState({ bills: [] })
      usePurchaseStore.setState({ purchases: [] })
      useInventoryStore.setState({ products: [], transferLog: [] })
      return deleted
    },
  },
} as const
