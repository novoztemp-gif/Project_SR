import type { SalesBill } from '@/types'

/**
 * Blank slate — the previous Cutter voucher layout (header block, item
 * table, logistics/footer sections) was cleared out at the client's
 * request, pending a new reference format to rebuild from. Renders nothing
 * but a blank printable page until that new format is provided.
 */
export function GlassCutterPrintable({ bill: _bill }: { bill: SalesBill }) {
  return <div className="printable-gp bg-white" />
}
