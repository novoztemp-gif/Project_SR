import { Badge } from '@/components/ui/badge'
import { COMPANY } from '@/lib/brand'
import { SECTIONS } from '@/lib/constants'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Godown, PurchaseBill } from '@/types'

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function godownLabelFor(godownId: string | undefined, godowns: Godown[]) {
  return godowns.find((godown) => godown.id === godownId)?.name ?? '—'
}

export function PrintablePurchase({ bill }: { bill: PurchaseBill }) {
  const godowns = useInventoryStore((s) => s.godowns)
  const sectionLabel = SECTIONS.find((section) => section.key === bill.section)?.label ?? bill.section
  const grandTotal = bill.total + bill.transportationAmount

  return (
    <div className="printable-bill bg-white p-6 text-sm text-gray-800">
      {/* print-running-header is fixed-positioned in print only (see
          index.css) — the browser repeats a position:fixed element at the
          same spot on every physical page, far more reliable across
          Chrome print/PDF than a repeating <thead> turned out to be.
          print-header-spacer reserves the matching space so the table
          never starts underneath it, on page 1 or any later page. */}
      <div className="print-running-header print-running-header--purchase">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-center text-[#1D546D]">{COMPANY.name}</p>
            <p className="text-xs text-center text-gray-600">{COMPANY.place}</p>
            <p className="mt-0.5 text-xs text-gray-600">
              123 Mount Road, Chennai - 600 002
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs uppercase tracking-widest text-[#5F9598]">
              PURCHASE VOUCHER
            </p>
            <p className="font-mono text-lg font-bold text-[#061E29]">{bill.voucherNumber}</p>
            <p className="mt-0.5 text-xs text-gray-600">{formatDate(bill.date)}</p>
          </div>
        </div>

        <hr className="mb-3 border-gray-300" />

        <div className="flex justify-between">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-gray-500">
              Received from
            </p>
            <p className="font-bold text-gray-900 truncate">{bill.vendorName}</p>
          </div>
          <div className="text-right">
            <p className="mb-1 text-xs uppercase tracking-wider text-gray-500">
              Section
            </p>
            <p className="text-gray-900">{sectionLabel}</p>
          </div>
        </div>
      </div>
      <div className="print-content-block print-content-block--purchase">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-100 text-xs uppercase tracking-widest text-gray-600">
              <th className="px-2 py-2 text-left font-medium text-gray-600 whitespace-nowrap">S.No</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 w-full">Item</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Godown</th>
              <th className="px-2 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Qty</th>
              <th className="px-2 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Unit price</th>
              <th className="px-2 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, index) => (
              <tr key={`${item.productId}-${item.productName}-${index}`} className="border-b border-gray-200 text-gray-800 odd:bg-white even:bg-gray-50">
                {/* S.No and Qty print as plain numbers — only prices/amounts
                    get the digit-letter cipher, a row count or a quantity
                    isn't sensitive the way a rate or a total is. */}
                <td className="px-2 py-2 font-mono tabular-nums text-gray-600 whitespace-nowrap">
                  {item.serialNumber || index + 1}
                </td>
                <td className="px-2 py-2">
                  <span>{item.productName}</span>
                  {!item.productId && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                      new
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{godownLabelFor(item.godownId ?? bill.godownId, godowns)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                  {item.quantity} {item.unit}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                  <span className="print:hidden">{INR.format(item.unitPrice)}</span>
                  <span className="hidden print:inline">{toLetterDigits(INR.format(item.unitPrice))}</span>
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                  <span className="print:hidden">{INR.format(item.subtotal)}</span>
                  <span className="hidden print:inline">{toLetterDigits(INR.format(item.subtotal))}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + footer move to the next page together as one block if
            they don't fit under the last item row (see print-keep-together
            in index.css). */}
        <div className="print-keep-together">
          <div className="mt-4 mb-6 flex justify-end">
            <div className="w-48 space-y-1">
              <div className="flex justify-between text-sm text-gray-900">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-mono font-semibold tabular-nums">
                  <span className="print:hidden">{INR.format(bill.subtotal)}</span>
                  <span className="hidden print:inline">{toLetterDigits(INR.format(bill.subtotal))}</span>
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-1 text-gray-900">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  <span className="print:hidden">{INR.format(bill.total)}</span>
                  <span className="hidden print:inline">{toLetterDigits(INR.format(bill.total))}</span>
                </span>
              </div>
              <div className="flex justify-between text-gray-900">
                <span className="text-gray-600">Transportation</span>
                <span className="font-mono tabular-nums">
                  <span className="print:hidden">{INR.format(bill.transportationAmount)}</span>
                  <span className="hidden print:inline">{toLetterDigits(INR.format(bill.transportationAmount))}</span>
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold text-gray-900">
                <span>Grand Total</span>
                <span className="font-mono tabular-nums">
                  <span className="print:hidden">{INR.format(grandTotal)}</span>
                  <span className="hidden print:inline">{toLetterDigits(INR.format(grandTotal))}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between border-t border-gray-300 pt-3">
            <p className="text-xs text-gray-400">Computer generated voucher</p>
            <div className="text-right">
              <div className="mb-1 w-36 border-t border-gray-300" />
              <p className="text-xs text-gray-400">Authorized signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
