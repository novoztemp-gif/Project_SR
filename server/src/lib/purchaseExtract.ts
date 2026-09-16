// LLM-backed PURCHASE bill extraction. Same mechanism as sales-bill scanning
// (see billExtract.ts) but reads a supplier/vendor invoice instead: the party
// to extract is whoever ISSUED the invoice (the letterhead/header), not the
// "bill to" name — that's usually this business itself, and must not be
// confused with the vendor. Purchase line items also have no separate sq.ft
// field in the app (the "Qty" column already carries whatever unit the
// invoice uses, sq.ft included), so the schema is simpler than the bill one.
import { callVisionExtraction, round2 } from './visionExtract.js'

// Kept in sync by hand with UNITS in src/lib/constants.ts — the frontend's
// Unit dropdown only offers these values, so a scanned unit that isn't one
// of them can never be used as-is.
const UNITS = ['pcs', 'box', 'sheet', 'length', 'tin', 'bag', 'roll', 'set', 'pair', 'kg', 'sq.ft', 'sq.m'] as const

export interface ParsedPurchaseItem {
  name: string
  qty: number
  rate: number
  sizeDimension: string
  unit: string
}

export interface ParsedPurchase {
  vendorName: string
  transportationAmount?: number
  items: ParsedPurchaseItem[]
}

const EXTRACTION_INSTRUCTIONS = [
  'You are a data-entry assistant for a building materials retailer (glass, plywood,',
  'plumbing, painting, electrical, hardware) reading a PURCHASE invoice/bill from one of its suppliers.',
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
  '- sizeDimension: any size/dimension printed for this item — thickness, WxH,',
  `  length, diameter, etc. (e.g. "10mm", "6x4 ft", "1/2 inch"). Empty string if none.`,
  `- unit: pick exactly ONE of: ${UNITS.join(', ')} — whichever best matches the`,
  '  item (a count of pieces is "pcs", a length/rod is "length", sheets of glass',
  '  or ply are "sheet", loose material sold by weight is "kg", etc.). Default to',
  '  "pcs" if genuinely unclear — always return one of this exact list, nothing else.',
  'Never put the line total into rate. If a column is missing, use 0 for numbers and an',
  'empty string for text. Do not invent items or values.',
  'Also extract, if shown anywhere on the document (leave 0 if not present — do not guess):',
  '- transportationAmount: a separate transportation/freight/delivery charge amount.',
].join(' ')

const PURCHASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['vendorName', 'transportationAmount', 'items'],
  properties: {
    vendorName: { type: 'string' },
    transportationAmount: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'qty', 'rate', 'amount', 'sizeDimension', 'unit'],
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          rate: { type: 'number' },
          amount: { type: 'number' },
          sizeDimension: { type: 'string' },
          unit: { type: 'string', enum: [...UNITS] },
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
    transportationAmount: Number(parsed.transportationAmount) || undefined,
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

      const unit = UNITS.includes(it?.unit) ? String(it.unit) : 'pcs'

      return {
        name: String(it?.name ?? ''),
        qty,
        rate: unitRate,
        sizeDimension: String(it?.sizeDimension ?? ''),
        unit,
      }
    }),
  }
}
