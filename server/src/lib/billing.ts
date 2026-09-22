import { BillStatus } from '@prisma/client'

/** Sq-ft items price as sqFt × rate; everything else as qty × rate. */
export function computeItemSubtotal(item: {
  quantity: number
  unitPrice: number
  sqFt?: number | null
}): number {
  return item.sqFt && item.sqFt > 0
    ? item.sqFt * item.unitPrice
    : item.quantity * item.unitPrice
}

export function getBillStatus(
  total: number,
  transportationAmount: number,
  discount: number,
  paidAmount: number,
  cuttingCharge = 0,
): BillStatus {
  const finalAmount = Math.max(total + transportationAmount + cuttingCharge - discount, 0)
  if (paidAmount >= finalAmount) return BillStatus.paid
  if (paidAmount > 0) return BillStatus.partial
  return BillStatus.pending
}
