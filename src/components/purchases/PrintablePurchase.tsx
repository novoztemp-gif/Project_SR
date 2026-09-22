import { Badge } from '@/components/ui/badge'
import { fmtGPDate } from '@/lib/glassPrintFormat'
import { getUserName } from '@/lib/userSections'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Godown, PurchaseBill, Section } from '@/types'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

// Purchase-voucher-only: the physical printout substitutes each digit with a
// letter (0=A, 1=B, 2=C, ...) so qty/rate/amount aren't plainly readable off
// the paper copy, while the app itself keeps showing real numbers on screen.
// Only digits are swapped — currency symbol, commas, and the decimal point
// are left as-is, same as the reference format this was modeled on.
// index = digit (0-9): 0=A, 1=C, 2=D, 3=E, 4=F, 5=G, 6=H, 7=I, 8=J, 9=K
const DIGIT_LETTERS = ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
function toLetterDigits(value: string) {
  return value.replace(/[0-9]/g, (digit) => DIGIT_LETTERS[Number(digit)])
}
function cipherAmount(value: number) {
  return toLetterDigits(INR.format(value))
}

/** "07:32:32 pm" — lowercase am/pm, matching this voucher's reference format. */
function fmtTime(iso: string) {
  const d = new Date(iso)
  const hours24 = d.getHours()
  const hours = String(hours24 % 12 || 12).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  const ampm = hours24 >= 12 ? 'pm' : 'am'
  return `${hours}:${minutes}:${seconds} ${ampm}`
}

// Exact wording per section for the title bar — kept separate from
// SECTIONS' own labels since a couple differ ("Electricals" here vs
// "Electrical" elsewhere).
const SECTION_HEADING: Record<Section, string> = {
  glass_plywood: 'Glass & Plywood',
  plumbing: 'Plumbing',
  painting: 'Painting',
  electrical: 'Electricals',
  hardware: 'Hardware',
}

const HEADER_CELL = 'border border-[#16232e] px-2 py-1.5 text-left font-semibold'
const CELL = 'border border-gray-300 px-2 py-1.5'

function godownLabelFor(godownId: string | undefined, godowns: Godown[]) {
  return godowns.find((godown) => godown.id === godownId)?.name ?? '—'
}

/**
 * Fixed-format purchase voucher — layout, columns and wording are pinned to
 * an exact reference format; don't restyle freely.
 */
export function PrintablePurchase({ bill }: { bill: PurchaseBill }) {
  const godowns = useInventoryStore((s) => s.godowns)
  const staffName = getUserName(bill.createdBy)

  const grandTotal = bill.total + bill.transportationAmount
  const finalAmount = grandTotal - bill.discount
  const balanceAmount = finalAmount - bill.paidAmount

  return (
    <div className="printable-bill bg-white p-6 text-sm text-gray-800">
      {/* print-running-header is fixed-positioned in print only (see
          index.css) — the browser repeats a position:fixed element at the
          same spot on every physical page, far more reliable across
          Chrome print/PDF than a repeating <thead> turned out to be.
          print-content-block reserves the matching space so the table
          never starts underneath it, on page 1 or any later page. */}
      <div className="print-running-header print-running-header--purchase">
        <div className="border-2 border-[#16232e]">
          <div className="border-b-2 border-[#16232e] py-1.5 text-center">
            <p className="text-sm font-extrabold uppercase tracking-wide">
              {SECTION_HEADING[bill.section]} - Purchase Details
            </p>
          </div>
          <div className="flex flex-wrap justify-between gap-x-8 gap-y-1 px-3 py-2 text-xs">
            <div className="space-y-0.5">
              <p><span className="font-semibold">Pur No :</span> {bill.voucherNumber}</p>
              <p className="truncate"><span className="font-semibold">Name :</span> {bill.vendorName}</p>
              <p className="truncate"><span className="font-semibold">Address :</span> {bill.vendorAddress || '-'}</p>
            </div>
            <div className="text-right space-y-0.5 whitespace-nowrap">
              <p><span className="font-semibold">Date :</span> {fmtGPDate(bill.date)}</p>
              <p><span className="font-semibold">Time :</span> {fmtTime(bill.date)}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="print-content-block print-content-block--purchase">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-white">
              <th className={`${HEADER_CELL} whitespace-nowrap`}>No.</th>
              <th className={`${HEADER_CELL} w-full`}>Particulars</th>
              <th className={`${HEADER_CELL} whitespace-nowrap print:hidden`}>Godown</th>
              <th className={`${HEADER_CELL} whitespace-nowrap text-right`}>Price</th>
              <th className={`${HEADER_CELL} whitespace-nowrap text-right`}>Qty</th>
              <th className={`${HEADER_CELL} whitespace-nowrap text-right`}>Amount Rs/-</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, index) => (
              <tr key={`${item.productId}-${item.productName}-${index}`}>
                {/* No. and Qty print as plain numbers — only prices/amounts
                    get the digit-letter cipher, a row count or a quantity
                    isn't sensitive the way a rate or a total is. */}
                <td className={`${CELL} text-center font-mono tabular-nums`}>
                  {item.serialNumber || index + 1}
                </td>
                <td className={CELL}>
                  <span>{item.productName}</span>
                  {!item.productId && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px] print:hidden">
                      new
                    </Badge>
                  )}
                </td>
                <td className={`${CELL} whitespace-nowrap print:hidden`}>{godownLabelFor(item.godownId ?? bill.godownId, godowns)}</td>
                <td className={`${CELL} text-right font-mono tabular-nums whitespace-nowrap`}>
                  <span className="print:hidden">{INR.format(item.unitPrice)}</span>
                  <span className="hidden print:inline">{toLetterDigits(INR.format(item.unitPrice))}</span>
                </td>
                <td className={`${CELL} text-right font-mono tabular-nums whitespace-nowrap`}>
                  {Number(item.quantity).toFixed(2)}
                </td>
                <td className={`${CELL} text-right font-mono tabular-nums whitespace-nowrap`}>
                  <span className="print:hidden">{INR.format(item.subtotal)}</span>
                  <span className="hidden print:inline">{toLetterDigits(INR.format(item.subtotal))}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + staff line move to the next page together as one block
            if they don't fit under the last item row (see print-keep-together
            in index.css). */}
        <div className="print-keep-together">
          <div className="flex border-x-2 border-b-2 border-[#16232e] text-xs">
            <div className="flex flex-1 items-center border-r border-gray-300 p-3">
              <p>
                <span className="font-semibold">Rupees:</span>{' '}
                <span className="print:hidden">{INR.format(finalAmount)}</span>
                <span className="hidden print:inline">{cipherAmount(finalAmount)}</span>{' '}
                Only
              </p>
            </div>
            <div className="w-64">
              <div className="flex justify-between border-b border-gray-300 px-3 py-1">
                <span className="font-semibold">Total</span>
                <span className="font-mono tabular-nums">
                  <span className="print:hidden">{INR.format(bill.total)}</span>
                  <span className="hidden print:inline">{cipherAmount(bill.total)}</span>
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-300 px-3 py-1">
                <span className="font-semibold">Transportation</span>
                <span className="font-mono tabular-nums">
                  <span className="print:hidden">{INR.format(bill.transportationAmount)}</span>
                  <span className="hidden print:inline">{cipherAmount(bill.transportationAmount)}</span>
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-300 px-3 py-1">
                <span className="font-semibold">Discount</span>
                <span className="font-mono tabular-nums">{INR.format(bill.discount)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-300 px-3 py-1">
                <span className="font-semibold">Final Amount</span>
                <span className="font-mono tabular-nums">
                  <span className="print:hidden">{INR.format(finalAmount)}</span>
                  <span className="hidden print:inline">{cipherAmount(finalAmount)}</span>
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-300 px-3 py-1">
                <span className="font-semibold">Paid Amount</span>
                <span className="font-mono tabular-nums">{INR.format(bill.paidAmount)}</span>
              </div>
              <div className="flex justify-between px-3 py-1">
                <span className="font-semibold">Balance Amount</span>
                <span className="font-mono tabular-nums">
                  <span className="print:hidden">{INR.format(balanceAmount)}</span>
                  <span className="hidden print:inline">{cipherAmount(balanceAmount)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-x-2 border-b-2 border-[#16232e] p-3 text-xs">
            <p className="font-semibold">Staff: {staffName}</p>
            {bill.writtenStaff && <p>Written Staff: {bill.writtenStaff}</p>}
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-end gap-x-4 gap-y-3 text-xs">
            <div className="text-right">
              <div className="mb-1 w-36 border-t border-gray-300" />
              <p className="text-gray-500">Authorized signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
