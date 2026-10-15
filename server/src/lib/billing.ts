import { BillStatus } from '@prisma/client'

/**
 * Sq-ft items price as sqFt × rate; everything else as qty × rate. Glass
 * line items add polishAmt/holeAmt/artAmt on top — separate cost
 * components the bill breaks out (Glass/Polish/Hole/Art), not folded into
 * the per-unit rate.
 *
 * Which branch applies is decided by `unit === 'sq.ft'`, matching the
 * frontend's own preview total (NewBillPage/GlassPlywoodBillingPage use
 * the identical `isSqFtUnit(item.unit)` check) — NOT by whether sqFt
 * happens to be > 0. A sq.ft item whose Sq.Ft box is still 0 (e.g. the
 * printed size didn't auto-parse and nobody typed it in) must price as
 * 0, same as what the counter saw on screen before saving; falling back
 * to qty × rate here instead would silently bill a per-sq-ft rate as if
 * it were a flat per-piece price, with no connection to what was shown.
 */
export function computeItemSubtotal(item: {
  quantity: number
  unitPrice: number
  unit: string
  sqFt?: number | null
  polishAmt?: number | null
  holeAmt?: number | null
  artAmt?: number | null
}): number {
  const base = item.unit.trim().toLowerCase() === 'sq.ft'
    ? (item.sqFt || 0) * item.unitPrice
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
