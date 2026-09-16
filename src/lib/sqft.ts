/**
 * Parses a free-typed "Size / Dimension" value like "6x6", "6 X 6", "6.5x4",
 * or "6*6" into width × height square footage. Returns null when the text
 * doesn't start with two numbers separated by x/X/×/* — an empty or
 * not-yet-finished size should show as genuinely blank, not "0".
 */
export function computeSqFtFromSize(size: string | undefined): number | null {
  if (!size) return null
  const match = size.trim().match(/^(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  return Math.round(width * height * 100) / 100
}
