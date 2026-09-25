import {
  ARCH_SHORT_LABELS,
  fmtGPDate,
  fmtGPTime,
  isArtWorkSet,
  POLISH_SIDE_CASH_LABELS,
  stripCornerSuffix,
  getHoleLabel,
} from '@/lib/glassPrintFormat'
import { amountInWords } from '@/lib/amountInWords'
import { COMPANY } from '@/lib/brand'
import { getUserName } from '@/lib/userSections'
import { useInventoryStore } from '@/store/inventoryStore'
import type { SalesBill, SalesItem } from '@/types'

// 2 decimals always — money totals.
const NUM = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Decimals only when non-zero — matches the reference's Amount Details
// breakdown (e.g. "2,100" but "1,827.60").
const NUM_TRIM = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const OUTER_BOX = 'border-2 border-t-0 border-[#16232e]'
const CELL = 'border border-gray-400 px-1.5 py-1.5 text-[9.5px]'
const HEADER_CELL = 'border border-[#16232e] px-1.5 py-1.5 font-semibold text-[9.5px] text-black'

function fabricationLine(item: SalesItem) {
  const arch = item.arch ? (ARCH_SHORT_LABELS[item.arch] ?? item.arch) : '-'
  const polish = item.polishSide
    ? `${POLISH_SIDE_CASH_LABELS[item.polishSide] ?? item.polishSide}${item.polishName ? ` (${item.polishName})` : ''}`
    : '-'
  return {
    arch,
    polish,
    corner: stripCornerSuffix(item.cornerType),
    hole: getHoleLabel(item.hole),
    // The reference format's fabrication summary line is a plain Yes/No —
    // unlike the Cutter voucher's Art column, which names the specific
    // option — since this line predates the 6-named-option redesign and
    // is just flagging "is there art work on this piece at all".
    artYesNo: isArtWorkSet(item.artWork) ? 'Yes' : 'No',
  }
}

/**
 * Fixed-format cash-counter print estimate — full pricing, per-item rate
 * breakdown, and the H/M/L priority + order-tracking footer. Layout,
 * columns and wording are pinned to an exact reference format; don't
 * restyle freely. Glass-only fabrication detail (Arch/Polish/Corner/Hole/
 * Art) and its cost breakdown only show for items whose product is
 * classified as glass — plywood/hardware rows print as plain product+price
 * lines with no fabrication detail, since those fields don't apply to them.
 */
export function GlassCashPrintable({ bill }: { bill: SalesBill }) {
  const voucher = bill.gpVoucherNumber ?? bill.billNumber
  const staffName = getUserName(bill.createdBy)
  const products = useInventoryStore((s) => s.products)
  const godowns = useInventoryStore((s) => s.godowns)

  const billGodowns: string[] = []
  const seenGodownIds = new Set<string>()
  for (const item of bill.items) {
    const product = products.find((p) => p.id === item.productId)
    if (!product || seenGodownIds.has(product.godownId)) continue
    seenGodownIds.add(product.godownId)
    const godown = godowns.find((g) => g.id === product.godownId)
    if (godown) billGodowns.push(godown.name)
  }

  const finalAmount = bill.total + bill.transportationAmount + bill.cuttingCharge - bill.discount
  const balanceAmount = Math.max(0, finalAmount - bill.paidAmount)

  return (
    <div className="printable-gp bg-white text-[#1a1a1a]">
      {/* print-running-header is fixed-positioned in print only (see
          index.css) — the browser repeats a position:fixed element at the
          same spot on every physical page. print-content-block reserves
          the matching space so the table never starts underneath it. */}
      <div className="print-running-header print-running-header--gp-cash">
        <div className="border-2 border-[#16232e]">
          <div className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
            <div className="leading-tight whitespace-nowrap">
              <p>{fmtGPDate(bill.createdAt)}</p>
              <p>{fmtGPTime(bill.createdAt)}</p>
            </div>
            <div className="text-center">
              <h1 className="text-base font-extrabold tracking-wide">{COMPANY.name}</h1>
              <p className="text-sm font-semibold">{COMPANY.place}</p>
            </div>
            <div className="text-right font-semibold leading-tight whitespace-nowrap">
              {billGodowns.map((name) => (
                <p key={name}>{name}</p>
              ))}
            </div>
          </div>
          <div className="border-t-2 border-[#16232e] py-1.5 text-center">
            <p className="text-sm font-extrabold tracking-wide">GLASS / PLYWOOD ESTIMATE</p>
          </div>
          <div className="flex flex-wrap justify-between gap-x-8 gap-y-1 border-t-2 border-[#16232e] px-3 py-2 text-xs">
            <div className="space-y-0.5">
              <p className="flex"><span className="w-20 shrink-0 font-semibold">Bill No</span><span>: {voucher}</span></p>
              <p className="flex"><span className="w-20 shrink-0 font-semibold">Name</span><span className="truncate">: {bill.customerName || '-'}</span></p>
              <p className="flex"><span className="w-20 shrink-0 font-semibold">Address</span><span className="truncate">: {bill.customerAddress || '-'}</span></p>
            </div>
            <div className="space-y-0.5 whitespace-nowrap">
              <p className="flex"><span className="w-28 shrink-0 font-semibold">Booking Date</span><span>: {fmtGPDate(bill.bookingDate ?? bill.date)}</span></p>
              <p className="flex"><span className="w-28 shrink-0 font-semibold">Delivery Date</span><span>: {fmtGPDate(bill.deliveryDate)}</span></p>
              <p className="flex"><span className="w-28 shrink-0 font-semibold">Transport</span><span>: {bill.transport || 'No'}</span></p>
            </div>
          </div>
        </div>
      </div>
      <div className="print-content-block print-content-block--gp-cash">
        <div className={OUTER_BOX}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white text-black">
                <th className={`${HEADER_CELL} whitespace-nowrap`}>No.</th>
                <th className={`${HEADER_CELL} text-left w-full`}>Product Name</th>
                <th className={`${HEADER_CELL} whitespace-nowrap`}>Size</th>
                <th className={`${HEADER_CELL} whitespace-nowrap`}>Qty</th>
                <th className={`${HEADER_CELL} whitespace-nowrap`}>Sq.ft</th>
                <th className={`${HEADER_CELL} whitespace-nowrap`}>Amount Details</th>
                <th className={`${HEADER_CELL} whitespace-nowrap`}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, i) => {
                const product = products.find((p) => p.id === item.productId)
                const isGlass = product?.productType === 'glass'
                const extras = (item.polishAmt ?? 0) + (item.holeAmt ?? 0) + (item.artAmt ?? 0)
                const glassAmt = Math.max(0, item.subtotal - extras)
                const fab = isGlass ? fabricationLine(item) : null
                return (
                  <tr key={i}>
                    <td className={`${CELL} text-center whitespace-nowrap`}>{item.serialNumber || i + 1}</td>
                    <td className={CELL}>
                      <p className="font-semibold">{item.productName}</p>
                      {fab && (
                        <p className="text-[8.5px] text-gray-600">
                          Arch: {fab.arch} | Polish: {fab.polish} | Corner: {fab.corner} | Hole: {fab.hole} | Art:{' '}
                          <span className={fab.artYesNo === 'Yes' ? 'font-semibold' : ''}>{fab.artYesNo}</span>
                        </p>
                      )}
                    </td>
                    <td className={`${CELL} text-center whitespace-nowrap`}>{item.glassSize || '-'}</td>
                    <td className={`${CELL} text-center whitespace-nowrap`}>{item.quantity}</td>
                    <td className={`${CELL} text-center whitespace-nowrap`}>{isGlass && item.sqFt ? NUM.format(item.sqFt) : '-'}</td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      {isGlass ? (
                        <>
                          <p>Glass: {NUM_TRIM.format(glassAmt)} | Polish: {NUM_TRIM.format(item.polishAmt ?? 0)}</p>
                          <p>Hole: {NUM_TRIM.format(item.holeAmt ?? 0)} | Art: {NUM_TRIM.format(item.artAmt ?? 0)}</p>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={`${CELL} text-right font-semibold whitespace-nowrap`}>{NUM.format(item.subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* The amount-in-words / E-X-A / H-M-L / ABI-15-A footer moves to
            the next page as one block if it doesn't fit under the last
            item row (see print-keep-together in index.css). */}
        <div className={`print-keep-together ${OUTER_BOX}`}>
          <table className="w-full border-collapse text-[10px]">
            <tbody>
              <tr>
                <td colSpan={4} rowSpan={2} className="border border-gray-400 px-2 py-1 align-top">
                  Rupees {amountInWords(Math.max(0, finalAmount))}
                </td>
                <td className="border border-gray-400 px-2 py-1">Cutting Charge</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{NUM.format(bill.cuttingCharge)}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-2 py-1 font-bold">Total</td>
                <td className="border border-gray-400 px-2 py-1 text-right font-bold">{NUM.format(bill.total)}</td>
              </tr>
              <tr>
                {/* E/X/A boxes carry no data or function — reproduced as
                    plain fixed labels to match the reference exactly. */}
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">E</td>
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">X</td>
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">A</td>
                <td className="border border-gray-400 px-2 py-1">&nbsp;</td>
                <td className="border border-gray-400 px-2 py-1">Discount</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{NUM.format(bill.discount)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-gray-400 px-2 py-1 font-semibold">
                  Staff Name : {staffName}
                </td>
                <td className="border border-gray-400 px-2 py-1 font-bold">Final Amount</td>
                <td className="border border-gray-400 px-2 py-1 text-right font-bold">{NUM.format(finalAmount)}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">H{bill.priority === 'H' && ' ✓'}</td>
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">M{bill.priority === 'M' && ' ✓'}</td>
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">L{bill.priority === 'L' && ' ✓'}</td>
                <td className="border border-gray-400 px-2 py-1">Cash Counter Less:</td>
                <td className="border border-gray-400 px-2 py-1">Paid Amount</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{NUM.format(bill.paidAmount)}</td>
              </tr>
              <tr>
                {/* ABI/15/A — written staff, order number, job description,
                    all set from the billing page. */}
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">{bill.writtenStaff || '-'}</td>
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">{bill.orderNumber || '-'}</td>
                <td className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">{bill.jobDescription || '-'}</td>
                <td className="border border-gray-400 px-2 py-1">Camera Time:</td>
                <td className="border border-gray-400 px-2 py-1">Balance Amount</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{NUM.format(balanceAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
