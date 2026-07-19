// LLM-backed bill extraction. Takes a base64 data URL (image OR PDF) and asks
// an OpenAI-compatible vision model to return structured bill details.
//
// The API key lives ONLY on the server (env.OPENAI_API_KEY) — never the browser.
// Uses the OpenAI Responses API so images and PDFs share one code path:
//   - image  -> { type: 'input_image', image_url }
//   - PDF    -> { type: 'input_file', filename, file_data }

import { env } from '../env.js'
import { ApiError } from '../middleware/error.js'

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

// data:<mime>;base64,<payload>
const DATA_URL_RE = /^data:([^;]+);base64,/

function detectKind(dataUrl: string): { mime: string; isPdf: boolean } {
  const match = DATA_URL_RE.exec(dataUrl)
  if (!match) {
    throw new ApiError(400, 'Expected a base64 data URL (data:<mime>;base64,...)')
  }
  const mime = match[1].toLowerCase()
  const isPdf = mime === 'application/pdf'
  if (!isPdf && !mime.startsWith('image/')) {
    throw new ApiError(400, `Unsupported file type "${mime}" — upload an image or PDF`)
  }
  return { mime, isPdf }
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

/** Pull the concatenated text output out of a Responses API payload. */
function readOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text) {
    return payload.output_text
  }
  const chunks: string[] = []
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text)
      }
    }
  }
  return chunks.join('')
}

export async function extractBillFromDataUrl(dataUrl: string): Promise<ParsedBill> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(503, 'Bill extraction is not configured — set OPENAI_API_KEY on the server')
  }

  const { mime, isPdf } = detectKind(dataUrl)

  const filePart = isPdf
    ? { type: 'input_file', filename: 'bill.pdf', file_data: dataUrl }
    : { type: 'input_image', image_url: dataUrl }

  const body = {
    model: env.OPENAI_MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Extract the bill details from this document.' },
          filePart,
        ],
      },
    ],
    instructions: EXTRACTION_INSTRUCTIONS,
    text: {
      format: {
        type: 'json_schema',
        name: 'parsed_bill',
        strict: true,
        schema: BILL_SCHEMA,
      },
    },
  }

  let res: Response
  try {
    res = await fetch(`${env.OPENAI_BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new ApiError(502, 'Could not reach the extraction service', String(err))
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new ApiError(502, `Extraction model error (${res.status})`, detail.slice(0, 500))
  }

  const payload = await res.json().catch(() => null)
  const text = readOutputText(payload)
  if (!text) throw new ApiError(502, 'Extraction model returned no content')

  let parsed: ParsedBill
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ApiError(502, 'Extraction model returned invalid JSON')
  }

  // Normalise so the client always gets a well-formed shape.
  void mime // available for logging if needed
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
