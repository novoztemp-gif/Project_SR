import { useBillingStore } from '@/store/billingStore'
import { useCounterStore } from '@/store/counterStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { usePurchaseStore } from '@/store/purchaseStore'

/**
 * Populate every client-side cache from the backend. Called after login and on
 * a full page reload (once the persisted session is validated).
 */
export async function hydrateAll(isAdmin: boolean): Promise<void> {
  await Promise.all([
    useInventoryStore.getState().hydrate(),
    useBillingStore.getState().hydrate(),
    usePurchaseStore.getState().hydrate(),
    ...(isAdmin ? [useCounterStore.getState().hydrate()] : []),
  ])
}
