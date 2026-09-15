// LLM-backed SALES bill extraction. Takes a base64 data URL (image OR PDF) of
// a customer-facing bill and asks a vision model to return structured details.
// The API key lives ONLY on the server (env.OPENAI_API_KEY) — never the browser.
import { callVisionExtraction, round2 } from './visionExtract.js'

// Kept in sync by hand with UNITS in src/lib/constants.ts — the frontend's
// Unit dropdown only offers these values, so a scanned unit that isn't one
// of them can never be used as-is.
const UNITS = ['pcs', 'box', 'sheet', 'length', 'tin', 'bag', 'roll', 'set', 'pair', 'kg'] as const

export interface ParsedBillItem {
  name: string
  qty: number
  sqFt: number
  rate: number
  sizeDimension: string
  unit: string
}

export interface ParsedBill {
  customerName: string
  customerPhone?: string
  customerAddress?: string
  deliveryDate?: string
  transport?: string
  transportTime?: string
  transportationAmount?: number
  discount?: number
  paidAmount?: number
  items: ParsedBillItem[]
}

const EXTRACTION_INSTRUCTIONS = [
  'You are a data-entry assistant for a building materials retailer (glass, plywood,',
  'plumbing, painting, electrical, hardware). Read the attached customer bill/invoice and extract the',
  'customer details and every line item. For each item return these fields exactly as',
  'printed, no currency symbols:',
  '- name: the item description.',
  '- qty: the quantity/number of pieces (default 1 if not shown).',
  '- rate: the PER-UNIT price (price of ONE piece / one sq.ft). This is the middle',
  '  "Rate" or "Price" column, NOT the line total.',
  '- amount: the LINE TOTAL for that row — the rightmost "Amount"/"Total" column',
  '  (usually qty × rate). Read this value carefully; it is the most reliable number.',
  '- sqFt: square-foot area if the item is priced by area, else 0.',
  '- sizeDimension: any size/dimension printed for this item — thickness, WxH,',
  `  length, diameter, etc. (e.g. "10mm", "6x4 ft", "1/2 inch"). Empty string if none.`,
  `- unit: pick exactly ONE of: ${UNITS.join(', ')} — whichever best matches the`,
  '  item (a count of pieces is "pcs", a length/rod is "length", sheets of glass',
  '  or ply are "sheet", loose material sold by weight is "kg", etc.). Default to',
  '  "pcs" if genuinely unclear — always return one of this exact list, nothing else.',
  'Never put the line total into rate. If a column is missing, use 0 for numbers and an',
  'empty string for text. Do not invent items or values.',
  'Also extract these document-level fields if shown anywhere on the page (leave as an',
  'empty string / 0 if not present — do not guess):',
  '- deliveryDate: the delivery date, formatted strictly as YYYY-MM-DD.',
  '- transport: the vehicle number, carrier, or transport name.',
  '- transportTime: the delivery/transport time as printed (e.g. "2 PM").',
  '- transportationAmount: a separate transportation/freight/delivery charge amount, if shown.',
  '- discount: a discount amount shown on the document.',
  '- paidAmount: an amount already paid / advance received, if shown.',
].join(' ')

// JSON Schema for structured output — forces valid, parseable JSON back.
const BILL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'customerName',
    'customerPhone',
    'customerAddress',
    'deliveryDate',
    'transport',
    'transportTime',
    'transportationAmount',
    'discount',
    'paidAmount',
    'items',
  ],
  properties: {
    customerName: { type: 'string' },
    customerPhone: { type: 'string' },
    customerAddress: { type: 'string' },
    deliveryDate: { type: 'string' },
    transport: { type: 'string' },
    transportTime: { type: 'string' },
    transportationAmount: { type: 'number' },
    discount: { type: 'number' },
    paidAmount: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'qty', 'sqFt', 'rate', 'amount', 'sizeDimension', 'unit'],
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          sqFt: { type: 'number' },
          rate: { type: 'number' },
          amount: { type: 'number' },
          sizeDimension: { type: 'string' },
          unit: { type: 'string', enum: [...UNITS] },
        },
      },
    },
  },
} as const

export async function extractBillFromDataUrl(dataUrl: string): Promise<ParsedBill> {
  const parsed = await callVisionExtraction(dataUrl, EXTRACTION_INSTRUCTIONS, BILL_SCHEMA, 'parsed_bill')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = Array.isArray(parsed.items) ? parsed.items : []
  return {
    customerName: parsed.customerName ?? '',
    customerPhone: parsed.customerPhone || undefined,
    customerAddress: parsed.customerAddress || undefined,
    deliveryDate: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.deliveryDate)) ? String(parsed.deliveryDate) : undefined,
    transport: parsed.transport || undefined,
    transportTime: parsed.transportTime || undefined,
    transportationAmount: Number(parsed.transportationAmount) || undefined,
    discount: Number(parsed.discount) || undefined,
    paidAmount: Number(parsed.paidAmount) || undefined,
    items: rawItems.map((it) => {
      const qty = Number(it?.qty) || 0
      const sqFt = Number(it?.sqFt) || 0
      const rate = Number(it?.rate) || 0
      const amount = Number(it?.amount) || 0

      // The client computes the line as qty × rate, so `rate` MUST be per-unit.
      // The printed "Amount" (line total) is the most reliable number, so derive
      // the per-unit rate from it. This prevents the double-multiply bug where the
      // model returns the line total in the rate field.
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
        sqFt,
        rate: unitRate,
        sizeDimension: String(it?.sizeDimension ?? ''),
        unit,
      }
    }),
  }
}
