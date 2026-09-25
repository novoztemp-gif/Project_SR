import { ARCH_ICONS_SMALL, POLISH_SIDE_ICONS_SMALL } from '@/components/billing/fabricationIcons'
import {
  ARCH_SHORT_LABELS,
  fmtGPDate,
  fmtGPTime,
  getArtWorkLabel,
  getHoleLabel,
  isArtWorkSet,
  POLISH_SIDE_CUTTER_LABELS,
} from '@/lib/glassPrintFormat'
import { COMPANY } from '@/lib/brand'
import { getUserName } from '@/lib/userSections'
import { useInventoryStore } from '@/store/inventoryStore'
import type { SalesBill } from '@/types'

// Font/padding kept deliberately tight — with 10 columns (incl. the
// fabrication detail group), the combined natural width of every
// whitespace-nowrap column left almost no room for Product Name on A5's
// ~140mm width, collapsing it to a few mm and wrapping product names
// letter-by-letter (confirmed via a headless-print render: the column
// shrank to 6.3mm and one row ballooned to 45mm tall). Smaller font/padding
// here, plus Product Name's own min-width below, keep that from recurring.
const HEADER_CELL = 'border border-[#16232e] px-1 py-1.5 font-semibold uppercase tracking-wide text-[9px]'
const CELL = 'border border-gray-600 px-1 py-1.5 text-[9.5px]'
const FILL_LINE = 'inline-block border-b border-gray-400'

// Fixed hand-fill checklist of pickup/delivery points — same blank-line
// codes on every voucher, not derived from the bill's data.
const LOGISTICS_CHECKLIST = ['K.G', 'CH.G', 'HOU.G', 'HAR.G', 'SHO.ROOM', 'Car G', 'Alapancode G']

/**
 * Fixed-format print voucher for the glass cutter / fabrication counter —
 * product + fabrication instructions only, no pricing. Layout, columns and
 * wording are pinned to an exact reference format; don't restyle freely.
 */
export function GlassCutterPrintable({ bill }: { bill: SalesBill }) {
  const voucher = bill.gpVoucherNumber ?? bill.billNumber
  const staffName = getUserName(bill.createdBy)

  // Which godown(s) to pull stock from — every distinct godown among this
  // bill's actual products, in first-appearance order, read from live
  // inventory (not snapshotted on the bill) since that's where the cutter
  // needs to go get it as of right now.
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

  return (
    <div className="printable-gp border-2 border-[#16232e] bg-white text-[#1a1a1a]">
      {/* print-running-header is fixed-positioned in print only (see
          index.css) — the browser repeats a position:fixed element at the
          same spot on every physical page, far more reliable across
          Chrome print/PDF than a repeating <thead> turned out to be.
          print-header-spacer reserves the matching space so the table
          never starts underneath it, on page 1 or any later page. */}
      <div className="print-running-header print-running-header--gp-cutter">
        <div className="border-2 border-[#16232e] rounded-t-md">
          <div className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
            <div className="leading-tight whitespace-nowrap">
              <p>{fmtGPDate(bill.createdAt)}</p>
              <p>{fmtGPTime(bill.createdAt)}</p>
            </div>
            <div className="text-center">
              <h1 className="text-base font-extrabold tracking-wide">{COMPANY.name}</h1>
              <p className="text-sm font-semibold">{COMPANY.place}</p>
            </div>
            <div className="flex items-start gap-2">
              {/* Unlabeled in the reference format — reproduced as-is. */}
              <span className="inline-block h-6 w-6 shrink-0 rounded-full border-2 border-[#16232e]" />
              <span className="inline-block h-6 w-6 shrink-0 border-2 border-[#16232e]" />
              {billGodowns.length > 0 && (
                <div className="text-right font-semibold leading-tight">
                  {billGodowns.map((name) => (
                    <p key={name} className="whitespace-nowrap">{name}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="border-t-2 border-[#16232e] py-1.5 text-center">
            <p className="text-sm font-extrabold tracking-wide">GLASS / PLYWOOD ESTIMATE</p>
          </div>
          <div className="flex flex-wrap justify-between gap-x-8 gap-y-1 border-t-2 border-[#16232e] px-3 py-2 text-xs">
            <div className="space-y-0.5">
              <p><span className="font-semibold">Bill No:</span> {voucher}</p>
              <p className="truncate"><span className="font-semibold">Name :</span> {bill.customerName || '-'}</p>
              <p className="truncate"><span className="font-semibold">Address:</span> {bill.customerAddress || '-'}</p>
            </div>
            <div className="text-right space-y-0.5 whitespace-nowrap">
              <p><span className="font-semibold">Booking Date :</span> {fmtGPDate(bill.bookingDate ?? bill.date)}</p>
              <p><span className="font-semibold">Delivery Date :</span> {fmtGPDate(bill.deliveryDate)}</p>
              <p><span className="font-semibold">Transport :</span> {bill.transport || '-'}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="print-content-block print-content-block--gp-cutter">
        <table className="w-full text-[9.5px] border-collapse">
          <thead>
            <tr className="bg-white text-[#16232e]">
              <th className={`${HEADER_CELL} whitespace-nowrap`}>&#10003;</th>
              <th className={`${HEADER_CELL} whitespace-nowrap`}>No.</th>
              <th className={`${HEADER_CELL} min-w-[15mm] text-left w-full`}>Product Name</th>
              <th className={`${HEADER_CELL} whitespace-nowrap`}>Size</th>
              <th className={`${HEADER_CELL} whitespace-nowrap`}>Qty</th>
              {/* Borderless spacer — a real gap between the item-detail and
                  fabrication column groups, not just cell padding. */}
              <th className="w-1 border-0 bg-white p-0" />
              <th className={`${HEADER_CELL} whitespace-nowrap`}>Arch</th>
              <th className={`${HEADER_CELL} whitespace-nowrap`}>Corner</th>
              <th className={`${HEADER_CELL} whitespace-nowrap`}>Polish Details</th>
              <th className={`${HEADER_CELL} whitespace-nowrap`}>Hole</th>
              <th className={`${HEADER_CELL} whitespace-nowrap`}>Art</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, i) => {
              const artSet = isArtWorkSet(item.artWork)
              // The table itself stays plain black-and-white — only the
              // fabrication text/values are colored (red when Art Work is
              // set, green on an alternating row otherwise), not the row's
              // own background.
              const textColor = artSet ? 'text-red-700' : i % 2 === 1 ? 'text-green-700' : ''
              return (
                <tr key={i}>
                  <td className={`${CELL} text-center`}>
                    <span className="inline-block h-2.5 w-2.5 border border-gray-500" />
                  </td>
                  <td className={`${CELL} text-center whitespace-nowrap ${textColor}`}>{item.serialNumber || i + 1}</td>
                  <td className={`${CELL} font-semibold ${textColor}`}>{item.productName}</td>
                  <td className={`${CELL} text-center whitespace-nowrap ${textColor}`}>{item.glassSize || '-'}</td>
                  <td className={`${CELL} text-center whitespace-nowrap ${textColor}`}>{item.quantity}</td>
                  <td className="w-1 border-0 bg-white p-0" />
                  <td className={`${CELL} whitespace-nowrap ${textColor}`}>
                    {item.arch ? (
                      <div className="flex flex-col items-center gap-0.5">
                        {ARCH_ICONS_SMALL[item.arch]}
                        <span>{ARCH_SHORT_LABELS[item.arch] ?? item.arch}</span>
                      </div>
                    ) : (
                      <span className="block text-center">-</span>
                    )}
                  </td>
                  <td className={`${CELL} text-center whitespace-nowrap ${textColor}`}>{item.cornerType || '-'}</td>
                  <td className={`${CELL} ${textColor}`}>
                    {item.polishSide ? (
                      <div className="flex items-center gap-1.5">
                        {POLISH_SIDE_ICONS_SMALL[item.polishSide]}
                        <div className="leading-tight">
                          <p className="font-semibold">{POLISH_SIDE_CUTTER_LABELS[item.polishSide] ?? item.polishSide}</p>
                          {item.polishName && <p className="text-[8.5px] text-gray-600">{item.polishName}</p>}
                        </div>
                      </div>
                    ) : (
                      <span className="block text-center">-</span>
                    )}
                  </td>
                  <td className={`${CELL} text-center whitespace-nowrap ${textColor}`}>{getHoleLabel(item.hole)}</td>
                  <td className={`${CELL} text-center whitespace-nowrap font-semibold ${textColor}`}>
                    {getArtWorkLabel(item.artWork)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Everything below the table moves to the next page together as
            one block if it doesn't fit under the last item row (see
            print-keep-together in index.css). */}
        <div className="print-keep-together mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap justify-center gap-6">
            {['Glass Cut', 'Edge Polished', 'Corner Rounded', 'Hole Drilled'].map((label) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 border border-gray-500" /> {label}
              </span>
            ))}
          </div>

          <div className="space-y-2 rounded border border-gray-400 p-3">
            <p className="flex flex-wrap items-baseline gap-1 uppercase">
              <span className="whitespace-nowrap font-semibold">Things Eduththavar Name:</span>
              <span className={`${FILL_LINE} min-w-[16rem] flex-1`}>&nbsp;</span>
              <span className="ml-4 whitespace-nowrap font-semibold">Sign:</span>
              <span className={`${FILL_LINE} w-28`}>&nbsp;</span>
            </p>
            {/* Fixed hand-fill checklist codes — kept in their original
                mixed case (e.g. "Car G", "Alapancode G"), not uppercased
                like the rest of this box. */}
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {LOGISTICS_CHECKLIST.map((label, i) => (
                <span key={label} className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="font-semibold">{label}</span>
                  <span className={`${FILL_LINE} w-10`}>&nbsp;</span>
                  {/* Trailing dash after the last entry, matching the reference exactly. */}
                  {i === LOGISTICS_CHECKLIST.length - 1 && <span>-</span>}
                </span>
              ))}
            </p>
            <p className="flex flex-wrap items-baseline gap-1 uppercase">
              <span className="whitespace-nowrap font-semibold">Driver Name:</span>
              <span className={`${FILL_LINE} w-24`}>&nbsp;</span>
              <span className="ml-2 whitespace-nowrap font-semibold">Sign:</span>
              <span className={`${FILL_LINE} w-16`}>&nbsp;</span>
              <span className="ml-2 whitespace-nowrap font-semibold">Key Out Time:</span>
              <span className={`${FILL_LINE} w-14`}>&nbsp;</span>
              <span className="ml-2 whitespace-nowrap font-semibold">Key In Time:</span>
              <span className={`${FILL_LINE} w-14`}>&nbsp;</span>
              <span className="ml-2 whitespace-nowrap font-semibold">Security Sign:</span>
              <span className={`${FILL_LINE} w-16`}>&nbsp;</span>
            </p>
          </div>

          <div className="flex flex-wrap items-baseline gap-4 rounded border border-gray-400 p-3 uppercase">
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-semibold">Serious :</span>
              <span className="inline-block h-2.5 w-2.5 border border-gray-500" />
            </span>
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-semibold">Long Route:</span>
              <span className="inline-block h-2.5 w-2.5 border border-gray-500" />
            </span>
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-semibold">Heavy Long:</span>
              <span className="inline-block h-2.5 w-2.5 border border-gray-500" />
            </span>
            <span className="flex flex-1 min-w-[14rem] items-baseline gap-1">
              <span className="whitespace-nowrap font-semibold">Long Route Extra Checking Name:</span>
              <span className={`${FILL_LINE} min-w-[6rem] flex-1`}>&nbsp;</span>
              <span className="whitespace-nowrap font-semibold">Sign:</span>
              <span className={`${FILL_LINE} w-16`}>&nbsp;</span>
            </span>
          </div>

          <p className="font-semibold">
            Staff: {staffName}
            {bill.writtenStaff && <span className="ml-6 font-normal">Written Staff: {bill.writtenStaff}</span>}
          </p>

          <div className="mt-8 flex flex-wrap justify-between gap-x-4 gap-y-3">
            <div className="w-[45%] min-w-[8rem] border-t border-gray-700 pt-1 text-center">Glass Cutter Signature</div>
            <div className="w-[45%] min-w-[8rem] border-t border-gray-700 pt-1 text-center">Quality Inspector Signature</div>
          </div>
        </div>
      </div>
    </div>
  )
}
