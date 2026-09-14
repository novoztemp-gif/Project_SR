import {
  ARCH_SHORT_LABELS,
  fmtGPDate,
  getArtWorkLabel,
  getHoleLabel,
  isArtWorkYes,
  POLISH_SIDE_CASH_LABELS,
  stripCornerSuffix,
} from '@/lib/glassPrintFormat'
import type { SalesBill, SalesItem } from '@/types'

const NUM = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

const HEADER_CELL = 'border border-[#16232e] px-1.5 py-1.5 font-semibold uppercase tracking-wide text-[10px]'
const CELL = 'border border-gray-300 px-1.5 py-1.5'

function fabricationSummary(item: SalesItem) {
  const arch = item.arch ? (ARCH_SHORT_LABELS[item.arch] ?? item.arch) : '-'
  const polish = item.polishSide
    ? `${POLISH_SIDE_CASH_LABELS[item.polishSide] ?? item.polishSide}${item.polishName ? ` (${item.polishName})` : ''}`
    : '-'
  return {
    arch,
    polish,
    corner: stripCornerSuffix(item.cornerType),
    hole: getHoleLabel(item.hole),
    artYes: isArtWorkYes(item.artWork),
    artLabel: getArtWorkLabel(item.artWork),
  }
}

/**
 * Fixed-format print estimate for the cash counter — full pricing and
 * customer details. Layout, columns and wording are pinned to an exact
 * reference format; don't restyle freely.
 */
export function GlassCashPrintable({ bill }: { bill: SalesBill }) {
  const balanceDue = Math.max(0, bill.total + bill.transportationAmount - bill.discount - bill.paidAmount)

  return (
    <div className="printable-gp bg-white text-[#1a1a1a]">
      <div className="text-center border-b-2 border-[#16232e] pb-2 mb-4">
        <h1 className="text-lg font-extrabold tracking-wide">SR - MELPURAM</h1>
        <p className="text-[10px] tracking-[0.2em] text-gray-600 uppercase">Glass / Plywood Estimate</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs mb-4">
        <div className="border border-gray-800 rounded overflow-hidden">
          <p className="bg-[#16232e] text-white text-center font-semibold py-1">Customer Details</p>
          <div className="p-2 space-y-0.5">
            <p><span className="font-semibold">Name:</span> {bill.customerName || '-'}</p>
            <p><span className="font-semibold">Phone:</span> {bill.customerPhone || '-'}</p>
            <p><span className="font-semibold">Address:</span> {bill.customerAddress || '-'}</p>
          </div>
        </div>
        <div className="border border-gray-800 rounded overflow-hidden">
          <p className="bg-[#16232e] text-white text-center font-semibold py-1">Order Information</p>
          <div className="p-2 space-y-0.5">
            <p><span className="font-semibold">Booking Date:</span> {fmtGPDate(bill.bookingDate ?? bill.date)}</p>
            <p>
              <span className="font-semibold">Delivery Date:</span> {fmtGPDate(bill.deliveryDate)}
              {bill.transportTime ? ` (${bill.transportTime})` : ''}
            </p>
            <p><span className="font-semibold">Transport:</span> {bill.transport || '-'}</p>
          </div>
        </div>
      </div>

      <table className="w-full text-[10.5px] border-collapse mb-3">
        <thead>
          <tr className="bg-[#16232e] text-white">
            <th className={`${HEADER_CELL} w-[5%]`}>No.</th>
            <th className={`${HEADER_CELL} w-[43%] text-left`}>Product &amp; Fabrication Details</th>
            <th className={`${HEADER_CELL} w-[12%]`}>Size</th>
            <th className={`${HEADER_CELL} w-[7%]`}>Qty</th>
            <th className={`${HEADER_CELL} w-[10%]`}>Sq.ft</th>
            <th className={`${HEADER_CELL} w-[23%]`}>Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => {
            const { arch, polish, corner, hole, artYes, artLabel } = fabricationSummary(item)
            const rowBg = artYes ? 'bg-red-50' : i % 2 === 1 ? 'bg-green-50' : 'bg-white'
            return (
              <tr key={i} className={rowBg}>
                <td className={`${CELL} text-center`}>{i + 1}</td>
                <td className={CELL}>
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-[9.5px] text-gray-600">
                    Arch: {arch} | Polish: {polish} | Corner: {corner} | Hole: {hole} | Art:{' '}
                    <span className={artYes ? 'text-red-700 font-semibold' : ''}>{artLabel}</span>
                  </p>
                </td>
                <td className={`${CELL} text-center`}>{item.glassSize || '-'}</td>
                <td className={`${CELL} text-center`}>{item.quantity}</td>
                <td className={`${CELL} text-center`}>{NUM.format(item.sqFt ?? 0)}</td>
                <td className={`${CELL} text-right font-semibold`}>{NUM.format(item.subtotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="mb-6 text-xs font-semibold tracking-[0.6em]">VA&nbsp;&nbsp;&nbsp;&nbsp;H&nbsp;&nbsp;&nbsp;&nbsp;M&nbsp;&nbsp;&nbsp;&nbsp;L</p>

      <div className="grid grid-cols-2 gap-6 items-stretch">
        <div className="border border-gray-800 rounded p-3 flex flex-col justify-between text-xs">
          <p className="font-semibold">Authorized Signature</p>
          <p className="border-t border-gray-500 pt-1 text-center text-[10px] text-gray-600">Physical Signature &amp; Stamp</p>
        </div>
        <div className="border border-gray-800 rounded overflow-hidden text-xs self-start">
          <div className="p-2 space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{INR.format(bill.total)}</span></div>
            <div className="flex justify-between"><span>Transportation</span><span>{INR.format(bill.transportationAmount)}</span></div>
            <div className="flex justify-between"><span>Paid Amount</span><span>{INR.format(bill.paidAmount)}</span></div>
          </div>
          <div className="flex justify-between bg-gray-100 px-2 py-1.5 font-bold border-t border-gray-800">
            <span>Balance Due</span><span>{INR.format(balanceDue)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
