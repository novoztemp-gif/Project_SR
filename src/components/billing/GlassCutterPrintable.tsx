import { ARCH_ICONS_SMALL, POLISH_SIDE_ICONS_SMALL } from '@/components/billing/fabricationIcons'
import {
  ARCH_SHORT_LABELS,
  fmtGPDate,
  getHoleLabel,
  isArtWorkYes,
  POLISH_SIDE_CUTTER_LABELS,
} from '@/lib/glassPrintFormat'
import type { SalesBill } from '@/types'

const HEADER_CELL = 'border border-[#16232e] px-1.5 py-1.5 font-semibold uppercase tracking-wide text-[10px]'
const CELL = 'border border-gray-300 px-1.5 py-1.5'

/**
 * Fixed-format print voucher for the glass cutter / fabrication counter —
 * product + fabrication instructions only, no pricing. Layout, columns and
 * wording are pinned to an exact reference format; don't restyle freely.
 */
export function GlassCutterPrintable({ bill }: { bill: SalesBill }) {
  const voucher = bill.gpVoucherNumber ?? bill.billNumber
  const totalQty = bill.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  return (
    <div className="printable-gp bg-white text-[#1a1a1a]">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b-2 border-[#16232e] pb-2 mb-3">
        <h1 className="text-sm font-extrabold uppercase tracking-wide">Glass Cutting &amp; Production Order</h1>
        <p className="text-xs whitespace-nowrap">
          <span className="font-semibold">Bill No:</span> {voucher} <span className="text-gray-500">| Page 1 of 1</span>
        </p>
      </div>

      <div className="flex flex-wrap justify-between gap-x-8 gap-y-2 text-xs mb-3">
        <div className="space-y-0.5">
          <p><span className="font-semibold">Customer:</span> {bill.customerName || '-'}</p>
          <p><span className="font-semibold">Place:</span> {bill.customerAddress || '-'}</p>
          <p className="flex items-center gap-1">
            <span className="font-semibold whitespace-nowrap">Operator:</span>
            <span className="inline-block border-b border-gray-500 w-28">&nbsp;</span>
          </p>
        </div>
        <div className="text-right space-y-0.5 whitespace-nowrap">
          <p><span className="font-semibold">Order Date</span> : {fmtGPDate(bill.bookingDate ?? bill.date)}</p>
          <p><span className="font-semibold">Delivery Date</span> : {fmtGPDate(bill.deliveryDate)}</p>
          <p><span className="font-semibold">Delivery Time</span> : {bill.transportTime || '-'}</p>
        </div>
      </div>

      <table className="w-full text-[10.5px] border-collapse">
        <thead>
          <tr className="bg-[#16232e] text-white">
            <th className={`${HEADER_CELL} w-[6%]`}>Check</th>
            <th className={`${HEADER_CELL} w-[4%]`}>No.</th>
            <th className={`${HEADER_CELL} w-[24%] text-left`}>Glass Name / Product</th>
            <th className={`${HEADER_CELL} w-[11%]`}>Size</th>
            <th className={`${HEADER_CELL} w-[6%]`}>Qty</th>
            <th className={`${HEADER_CELL} w-[10%]`}>Arch</th>
            <th className={`${HEADER_CELL} w-[11%]`}>Corner Type</th>
            <th className={`${HEADER_CELL} w-[18%]`}>Polish Side &amp; Polish Name</th>
            <th className={`${HEADER_CELL} w-[5%]`}>Hole</th>
            <th className={`${HEADER_CELL} w-[5%]`}>Art Work</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => {
            const artYes = isArtWorkYes(item.artWork)
            const rowBg = artYes ? 'bg-red-50' : i % 2 === 1 ? 'bg-green-50' : 'bg-white'
            const textColor = artYes ? 'text-red-700' : ''
            return (
              <tr key={i} className={rowBg}>
                <td className={`${CELL} text-center`}>
                  <span className="inline-block h-2.5 w-2.5 border border-gray-500" />
                </td>
                <td className={`${CELL} text-center ${textColor}`}>{item.serialNumber || i + 1}</td>
                <td className={`${CELL} font-semibold ${textColor}`}>{item.productName}</td>
                <td className={`${CELL} text-center ${textColor}`}>{item.glassSize || '-'}</td>
                <td className={`${CELL} text-center ${textColor}`}>{item.quantity}</td>
                <td className={`${CELL} ${textColor}`}>
                  {item.arch ? (
                    <div className="flex items-center justify-center gap-1">
                      {ARCH_ICONS_SMALL[item.arch]}
                      <span>{ARCH_SHORT_LABELS[item.arch] ?? item.arch}</span>
                    </div>
                  ) : (
                    <span className="block text-center">-</span>
                  )}
                </td>
                <td className={`${CELL} text-center ${textColor}`}>{item.cornerType || '-'}</td>
                <td className={`${CELL} ${textColor}`}>
                  {item.polishSide ? (
                    <div className="flex items-center gap-1.5">
                      {POLISH_SIDE_ICONS_SMALL[item.polishSide]}
                      <div className="leading-tight">
                        <p className="font-semibold">{POLISH_SIDE_CUTTER_LABELS[item.polishSide] ?? item.polishSide}</p>
                        {item.polishName && <p className="text-[9.5px] text-gray-600">{item.polishName}</p>}
                      </div>
                    </div>
                  ) : (
                    <span className="block text-center">-</span>
                  )}
                </td>
                <td className={`${CELL} text-center ${textColor}`}>{getHoleLabel(item.hole)}</td>
                <td className={`${CELL} text-center font-semibold ${artYes ? 'text-red-700' : ''}`}>
                  {artYes ? 'YES' : 'No'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-4 border border-gray-400 rounded p-3 text-xs">
        <p className="font-semibold mb-2">Glass Process:</p>
        <div className="flex flex-wrap gap-6">
          {['Glass Cut', 'Edge Polished', 'Corner Rounded', 'Hole Drilled'].map((label) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 border border-gray-500" /> {label}
            </span>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-300 flex flex-wrap justify-between gap-x-4 gap-y-1">
          <p>
            <span className="font-semibold">Batch Summary:</span> {bill.items.length} Items (Total Qty: {totalQty} Sheets)
          </p>
          <p className="text-gray-500">SR Fabrication Dept.</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap justify-between gap-x-4 gap-y-3 text-xs">
        <div className="w-[45%] min-w-[8rem] border-t border-gray-700 pt-1 text-center">Glass Cutter Signature</div>
        <div className="w-[45%] min-w-[8rem] border-t border-gray-700 pt-1 text-center">Quality Inspector Signature</div>
      </div>
    </div>
  )
}
