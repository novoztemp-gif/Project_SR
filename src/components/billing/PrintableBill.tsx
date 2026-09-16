import { COMPANY } from '@/lib/brand'
import { amountInWords } from '@/lib/amountInWords'
import { SECTIONS } from '@/lib/constants'
import { getUserName } from '@/lib/userSections'
import type { SalesBill } from '@/types'

const NUM = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function PrintableBill({ bill }: { bill: SalesBill }) {
  const finalAmount   = bill.total + bill.transportationAmount - bill.discount
  const balanceAmount = finalAmount - bill.paidAmount

  const staffName = getUserName(bill.createdBy)

  const sectionLabel = SECTIONS.find((s) => s.key === bill.section)?.label ?? bill.section

  const dateTime = new Date(bill.date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="printable-bill bg-white p-8 font-mono text-sm text-gray-800">

      {/* ── Header ── */}
      <div className="text-center mb-4">
        <p className="text-xl font-bold font-sans tracking-wide text-brand-dark">{COMPANY.name}</p>
        <p className="text-xs text-gray-600 mt-0.5">{COMPANY.place}</p>
        <p className="text-xs text-gray-600 mt-1">{dateTime}</p>
      </div>

      {/* ── Title ── */}
      <p className="text-center font-semibold underline uppercase tracking-widest text-xs mb-6 text-[#1D546D]">
        Products Estimate
      </p>

      {/* ── Meta block ── */}
      <div className="flex justify-between mb-4 text-xs gap-8">
        <div className="space-y-1 min-w-0">
          <div className="flex gap-1">
            <span className="text-[#1D546D] shrink-0">Bill No :</span>
            <span className="font-medium text-gray-900">{bill.gpVoucherNumber ?? bill.billNumber}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-gray-600 shrink-0">Name    :</span>
            <span>{bill.customerName ?? '—'}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-gray-600 shrink-0">Address :</span>
            <span>{bill.customerAddress ?? '—'}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-gray-600 shrink-0">Section :</span>
            <span className="text-gray-800">{sectionLabel}</span>
          </div>
        </div>
        <div className="space-y-1 text-right shrink-0">
          <div>
            <span className="text-gray-600">Booking Date  : </span>
            {bill.bookingDate ? fmtDate(bill.bookingDate) : '—'}
          </div>
          <div>
            <span className="text-gray-600">Delivery Date : </span>
            {bill.deliveryDate ? fmtDate(bill.deliveryDate) : '—'}
          </div>
          <div>
            <span className="text-gray-600">Transport     : </span>
            {bill.transport ?? '—'}
            {bill.transportTime ? ` / ${bill.transportTime}` : ''}
          </div>
        </div>
      </div>

      <hr className="border-gray-300 mb-4" />

      {/* ── Items table ── */}
      <table className="w-full text-xs mb-6">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-100 text-gray-700">
            <th className="text-left py-1.5 font-medium pr-2 w-6 text-gray-700">#</th>
            <th className="text-left py-1.5 font-medium pr-2 text-gray-700">Materials Name</th>
            <th className="text-left py-1.5 font-medium pr-2 w-24 text-gray-700">Size / Dimension</th>
            <th className="text-right py-1.5 font-medium pr-2 w-10 text-gray-700">Qty</th>
            <th className="text-left py-1.5 font-medium pr-2 w-20 text-gray-700">Model</th>
            <th className="text-right py-1.5 font-medium pr-2 w-16 text-gray-700">Sq/-</th>
            <th className="text-right py-1.5 font-medium w-20 text-gray-700">Amount Rs/-</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => (
            <tr key={i} className="border-b border-gray-200 text-gray-800">
              <td className="py-1.5 pr-2 tabular-nums text-gray-600">{item.serialNumber || i + 1}</td>
              <td className="py-1.5 pr-2">{item.productName}</td>
              <td className="py-1.5 pr-2 text-gray-600">{item.glassSize ?? ''}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{item.quantity}</td>
              <td className="py-1.5 pr-2 text-gray-600">{item.model ?? ''}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{NUM.format(item.unitPrice)}</td>
              <td className="py-1.5 text-right tabular-nums">{NUM.format(item.subtotal)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={6} className="py-1.5 pr-2 text-right font-semibold uppercase tracking-wider text-[10px] pt-2 border-t border-gray-300 text-gray-900">
              Total
            </td>
            <td className="py-1.5 text-right tabular-nums font-semibold border-t border-gray-300 text-gray-900">
              {NUM.format(bill.total)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Totals stack ── */}
      <div className="flex justify-end mb-4">
        <div className="w-64 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Total</span>
            <span className="tabular-nums text-gray-900">{NUM.format(bill.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Transportation</span>
            <span className="tabular-nums text-gray-900">{NUM.format(bill.transportationAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Paid Amount</span>
            <span className="tabular-nums text-gray-900">{NUM.format(bill.paidAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Discount</span>
            <span className="tabular-nums text-gray-900">{NUM.format(bill.discount)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-gray-300 pt-1 text-brand-dark">
            <span>Balance Amount</span>
            <span className="tabular-nums">{NUM.format(balanceAmount)}</span>
          </div>
        </div>
      </div>

      {/* ── Amount in words ── */}
      <p className="text-xs italic text-gray-600 mb-6">
        {amountInWords(Math.max(0, balanceAmount))}
      </p>

      {/* ── Footer ── */}
      <div className="flex justify-between items-end border-t border-gray-300 pt-4 text-xs">
        <p className="text-gray-600">Staff Name : {staffName}</p>
        <div className="text-right">
          <div className="border-t border-gray-900 w-36 mb-1" />
          <p className="text-gray-600">Authorized signature</p>
        </div>
      </div>
    </div>
  )
}
