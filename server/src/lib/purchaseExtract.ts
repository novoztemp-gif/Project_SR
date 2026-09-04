// LLM-backed PURCHASE bill extraction. Same mechanism as sales-bill scanning
// (see billExtract.ts) but reads a supplier/vendor invoice instead: the party
// to extract is whoever ISSUED the invoice (the letterhead/header), not the
// "bill to" name — that's usually this business itself, and must not be
// confused with the vendor. Purchase line items also have no separate sq.ft
// field in the app (the "Qty" column already carries whatever unit the
// invoice uses, sq.ft included), so the schema is simpler than the bill one.
import { callVisionExtraction, round2 } from './visionExtract.js'

export interface ParsedPurchaseItem {
  name: string
  qty: number
  rate: number
}

export interface ParsedPurchase {
  vendorName: string
  items: ParsedPurchaseItem[]
}

const EXTRACTION_INSTRUCTIONS = [
  'You are a data-entry assistant for a hardware retailer (glass, plywood, plumbing,',
  'painting, electrical) reading a PURCHASE invoice/bill from one of its suppliers.',
  'The document was issued BY the supplier/vendor TO this business — extract the',
  'SELLER/SUPPLIER identity (usually the company name in the letterhead, header, or',
  '"From" field, often with a GST/logo block), NOT the buyer/"Bill To" name.',
  'For each line item return these fields exactly as printed, no currency symbols:',
  '- name: the item description.',
  '- qty: the quantity column as printed — this may be in pieces, sq.ft, kg, etc.,',
  '  whatever unit the invoice itself uses (default 1 if not shown).',
  '- rate: the PER-UNIT price (price of ONE unit of qty). This is the middle "Rate"',
  '  or "Price" column, NOT the line total.',
  '- amount: the LINE TOTAL for that row — the rightmost "Amount"/"Total" column',
  '  (usually qty × rate). Read this value carefully; it is the most reliable number.',
  'Never put the line total into rate. If a column is missing, use 0 for numbers and an',
  'empty string for text. Do not invent items or values.',
].join(' ')

const PURCHASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['vendorName', 'items'],
  properties: {
    vendorName: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'qty', 'rate', 'amount'],
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          rate: { type: 'number' },
          amount: { type: 'number' },
        },
      },
    },
  },
} as const

export async function extractPurchaseFromDataUrl(dataUrl: string): Promise<ParsedPurchase> {
  const parsed = await callVisionExtraction(dataUrl, EXTRACTION_INSTRUCTIONS, PURCHASE_SCHEMA, 'parsed_purchase')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = Array.isArray(parsed.items) ? parsed.items : []
  return {
    vendorName: parsed.vendorName ?? '',
    items: rawItems.map((it) => {
      const qty = Number(it?.qty) || 0
      const rate = Number(it?.rate) || 0
      const amount = Number(it?.amount) || 0

      // Same double-multiply guard as bill extraction: derive the per-unit
      // rate from the (more reliable) printed line total when possible.
      let unitRate = rate
      if (amount > 0 && qty > 0) {
        unitRate = round2(amount / qty)
      } else if (amount > 0 && qty === 0) {
        unitRate = round2(amount)
      }

      return { name: String(it?.name ?? ''), qty, rate: unitRate }
    }),
  }
}
