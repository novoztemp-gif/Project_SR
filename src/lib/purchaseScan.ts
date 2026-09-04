import { http } from '@/lib/apiClient'

export interface ParsedPurchaseItem {
  name: string
  qty: number
  rate: number
}

export interface ParsedPurchase {
  vendorName: string
  items: ParsedPurchaseItem[]
}

/**
 * Send a base64 data URL of a purchase invoice (image or PDF) to the backend,
 * which runs it through the vision LLM and returns the vendor name + line
 * items. The API key stays on the server — the browser only ever ships the
 * data URL.
 */
export async function extractPurchaseFromImage(dataUrl: string): Promise<ParsedPurchase> {
  return http.post<ParsedPurchase>('/purchases/extract', { dataUrl })
}
