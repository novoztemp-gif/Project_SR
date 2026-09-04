// LLM-backed SALES bill extraction. Takes a base64 data URL (image OR PDF) of
// a customer-facing bill and asks a vision model to return structured details.
// The API key lives ONLY on the server (env.OPENAI_API_KEY) — never the browser.
import { callVisionExtraction, round2 } from './visionExtract.js'

export interface ParsedBillItem {
  name: string
  qty: number
  sqFt: number
  rate: number
}

export interface ParsedBill {
  customerName: string
  customerPhone?: string
  customerAddress?: string
  items: ParsedBillItem[]
}

const EXTRACTION_INSTRUCTIONS = [
  'You are a data-entry assistant for a hardware retailer (glass, plywood, plumbing,',
  'painting, electrical). Read the attached customer bill/invoice and extract the',
  'customer details and every line item. For each item return these fields exactly as',
  'printed, no currency symbols:',
  '- name: the item description.',
  '- qty: the quantity/number of pieces (default 1 if not shown).',
  '- rate: the PER-UNIT price (price of ONE piece / one sq.ft). This is the middle',
  '  "Rate" or "Price" column, NOT the line total.',
  '- amount: the LINE TOTAL for that row — the rightmost "Amount"/"Total" column',
  '  (usually qty × rate). Read this value carefully; it is the most reliable number.',
  '- sqFt: square-foot area if the item is priced by area, else 0.',
  'Never put the line total into rate. If a column is missing, use 0 for numbers and an',
  'empty string for text. Do not invent items or values.',
].join(' ')

// JSON Schema for structured output — forces valid, parseable JSON back.
const BILL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['customerName', 'customerPhone', 'customerAddress', 'items'],
  properties: {
    customerName: { type: 'string' },
    customerPhone: { type: 'string' },
    customerAddress: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'qty', 'sqFt', 'rate', 'amount'],
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          sqFt: { type: 'number' },
          rate: { type: 'number' },
          amount: { type: 'number' },
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

      return { name: String(it?.name ?? ''), qty, sqFt, rate: unitRate }
    }),
  }
}
