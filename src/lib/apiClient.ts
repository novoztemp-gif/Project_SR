// Thin fetch wrapper for the backend API. The auth token is kept in localStorage
// (written by authStore) so this module has no import cycle with the store.

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
const TOKEN_KEY = 'billing-app-token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiClientError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.details = details
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Skip attaching the Authorization header (used for login). */
  auth?: boolean
  query?: Record<string, string | number | undefined>
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 / empty body
  if (res.status === 204) return undefined as T

  let payload: unknown = null
  let parseFailed = false
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
      parseFailed = true
    }
  }

  if (!res.ok) {
    const message =
      (payload as { error?: string })?.error ?? `Request failed (${res.status})`
    const details = (payload as { details?: unknown })?.details
    // Auto-logout on auth failure.
    if (res.status === 401) setToken(null)
    throw new ApiClientError(res.status, message, details)
  }

  // The API always answers with JSON (or an empty body, handled above). A 200
  // with non-JSON text means the request never actually reached the backend —
  // e.g. a misconfigured dev proxy or reverse proxy routed it to the SPA's own
  // index.html instead. Silently returning that HTML as if it were the real
  // payload was masking real failures as generic, unrelated crashes downstream.
  if (parseFailed) {
    throw new ApiClientError(res.status, 'Server returned an unexpected (non-JSON) response — check the API routing/proxy')
  }

  return payload as T
}

export const http = {
  get: <T>(path: string, query?: RequestOptions['query']) => apiFetch<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}
