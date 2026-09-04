import type { Product } from '@/types'

/** Split a product name into lowercase alphanumeric tokens for order-insensitive matching. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Fuzzy-matches a scanned item name against the inventory by token overlap
 * (Jaccard similarity), so a scanned "6mm Clear Float Glass" can still match
 * an inventory entry named "6mm Float Glass (Clear)" despite reordering.
 */
export function findBestProductMatch(name: string, products: Product[]): Product | undefined {
  const scan = tokenize(name)
  if (!scan.length) return undefined
  const scanSet = new Set(scan)

  let best: { product: Product; score: number } | undefined
  for (const product of products) {
    const prod = tokenize(product.name)
    if (!prod.length) continue
    const prodSet = new Set(prod)

    const inter = [...scanSet].filter((t) => prodSet.has(t)).length
    if (!inter) continue
    const union = new Set([...scanSet, ...prodSet]).size
    const jaccard = inter / union
    // Order-insensitive: match on strong token overlap, OR when every scanned
    // token (2+) is present in the product (the scan doesn't contradict it).
    const scanFullyIn = scan.length >= 2 && scan.every((t) => prodSet.has(t))

    if ((jaccard >= 0.6 || scanFullyIn) && (!best || jaccard > best.score)) {
      best = { product, score: jaccard }
    }
  }
  return best?.product
}
