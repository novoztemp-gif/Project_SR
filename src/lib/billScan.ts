import { http } from '@/lib/apiClient'

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

/**
 * Send a base64 data URL of a bill (image or PDF) to the backend, which runs it
 * through the vision LLM and returns structured details. The API key stays on the
 * server — the browser only ever ships the data URL.
 */
export async function extractBillFromImage(dataUrl: string): Promise<ParsedBill> {
  return http.post<ParsedBill>('/bills/extract', { dataUrl })
}
