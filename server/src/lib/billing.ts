import { BillStatus } from '@prisma/client'

/**
 * Sq-ft items price as sqFt × rate; everything else as qty × rate. Glass
 * line items add polishAmt/holeAmt/artAmt on top — separate cost
 * components the bill breaks out (Glass/Polish/Hole/Art), not folded into
 * the per-unit rate.
 */
export function computeItemSubtotal(item: {
  quantity: number
  unitPrice: number
  sqFt?: number | null
  polishAmt?: number | null
  holeAmt?: number | null
  artAmt?: number | null
}): number {
  const base = item.sqFt && item.sqFt > 0
    ? item.sqFt * item.unitPrice
    : item.quantity * item.unitPrice
  const extras = (item.polishAmt || 0) + (item.holeAmt || 0) + (item.artAmt || 0)
  return base + extras
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
