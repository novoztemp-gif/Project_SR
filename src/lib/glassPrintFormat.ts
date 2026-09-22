// Shared value → display-label mappings for the Glass & Plywood Cutter and
// Cash print formats. Each fabrication field stores the same raw value
// (from src/lib/constants.ts's option lists); the two printouts just show
// it worded differently, so the mappings live in one place to keep them
// from drifting apart.

/** "11-09-2026" — the exact date style used on both printed formats. */
export function fmtGPDate(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

/** "01:10:53 PM" — the Cutter voucher's header timestamp. Built manually
 * rather than via toLocaleTimeString, whose AM/PM casing (and format
 * generally) follows the browser/OS locale, not anything this page
 * controls — the same class of bug DateInput had. */
export function fmtGPTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hours24 = d.getHours()
  const hours = String(hours24 % 12 || 12).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  const ampm = hours24 >= 12 ? 'PM' : 'AM'
  return `${hours}:${minutes}:${seconds} ${ampm}`
}

export const ARCH_SHORT_LABELS: Record<string, string> = {
  'arch-top': 'Arch',
  'flat-square': 'Flat',
}

/** Long-form wording used in the Cutter print's dedicated Arch/Polish column. */
export const POLISH_SIDE_CUTTER_LABELS: Record<string, string> = {
  'four-side': 'All 4 Edges',
  'one-side-bottom': 'Bottom Only',
  'one-side-top': 'Top Only',
  'one-side-right': 'Right Only',
  'one-side-left': 'Left Only',
  'two-side-tb': 'Top & Bottom',
  'two-side-lr': 'Left & Right',
  'round-all': 'Round (All)',
  'oval-plain': 'Oval (Plain)',
  'oval-all': 'Oval (All)',
}

/** Compact wording used inline in the Cash print's fabrication summary line. */
export const POLISH_SIDE_CASH_LABELS: Record<string, string> = {
  'four-side': '4 Sides',
  'one-side-bottom': 'Bottom',
  'one-side-top': 'Top',
  'one-side-right': 'Right',
  'one-side-left': 'Left',
  'two-side-tb': 'T&B',
  'two-side-lr': 'L&R',
  'round-all': 'Round',
  'oval-plain': 'Oval',
  'oval-all': 'Oval (All)',
}

/** "1/4&quot; Corner" -> "1/4&quot;" for the Cash print's "Corner: …" summary. */
export function stripCornerSuffix(value?: string): string {
  if (!value) return '-'
  return value.replace(/\s*Corner$/i, '')
}

export function getHoleLabel(value?: string): string {
  return value || '0'
}

/** Any of the named art work options (White Design, Line Design, …) picked — as opposed to none. */
export function isArtWorkSet(value?: string): boolean {
  return !!(value ?? '').trim()
}

export function getArtWorkLabel(value?: string): string {
  const trimmed = (value ?? '').trim()
  return trimmed || '–'
}
