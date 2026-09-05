// Shared low-level plumbing for LLM-backed document extraction. Bill scanning
// and purchase scanning both need "send an image/PDF to a vision model, get
// back strict JSON" — this is that call, factored out so the two callers only
// have to supply their own instructions/schema, not duplicate the OpenAI
// Responses API request/response handling.
import sharp from 'sharp'

import { env } from '../env.js'
import { ApiError } from '../middleware/error.js'

// data:<mime>;base64,<payload>
const DATA_URL_RE = /^data:([^;]+);base64,/
const MAX_IMAGE_DIMENSION = 2500

export function detectKind(dataUrl: string): { mime: string; isPdf: boolean } {
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

/**
 * Re-encodes an uploaded/scanned image into a clean, correctly-labeled JPEG
 * before it's ever shown to the vision model — decoding from the real bytes
 * rather than trusting whatever the browser/device claimed the format was,
 * and capping oversized dimensions (a full-resolution phone photo or an
 * uncropped scanner-bed image can be tens of megapixels). Mirrors the same
 * normalization scanner-bridge does for its own scans — this covers the
 * direct Upload path, which never goes through scanner-bridge at all.
 * PDFs pass through untouched (sharp only handles raster images). On any
 * decode failure, falls back to the original bytes rather than blocking
 * the request outright — better to let the model's own error surface than
 * to invent a new failure mode here.
 */
async function normalizeImage(dataUrl: string): Promise<string> {
  try {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const input = Buffer.from(base64, 'base64')
    const normalized = await sharp(input)
      .rotate() // apply EXIF orientation before it's lost, then strip it
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()
    return `data:image/jpeg;base64,${normalized.toString('base64')}`
  } catch (err) {
    console.error('[extract] Could not normalize image, using it as-is:', err)
    return dataUrl
  }
}

/** Pull the concatenated text output out of a Responses API payload. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Sends a base64 data URL (image or PDF) to the configured vision model along
 * with domain-specific instructions and a strict JSON schema, and returns the
 * parsed JSON. Throws ApiError on any failure (missing key, unreachable
 * service, non-2xx response, unparseable output).
 */
export async function callVisionExtraction(
  dataUrl: string,
  instructions: string,
  schema: object,
  schemaName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(503, 'Document extraction is not configured — set OPENAI_API_KEY on the server')
  }

  const { isPdf } = detectKind(dataUrl)
  const normalizedDataUrl = isPdf ? dataUrl : await normalizeImage(dataUrl)

  const filePart = isPdf
    ? { type: 'input_file', filename: 'document.pdf', file_data: normalizedDataUrl }
    : { type: 'input_image', image_url: normalizedDataUrl }

  const body = {
    model: env.OPENAI_MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Extract the details from this document.' },
          filePart,
        ],
      },
    ],
    instructions,
    text: {
      format: {
        type: 'json_schema',
        name: schemaName,
        strict: true,
        schema,
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

  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(502, 'Extraction model returned invalid JSON')
  }
}
