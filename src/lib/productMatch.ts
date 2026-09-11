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
 * Collapses a string to just its lowercase letters/digits with every
 * separator removed — "10 mm Float Glass" and "10mm Float Glass" become the
 * identical "10mmfloatglass". Word-token matching alone treats those as two
 * different tokens ("10"+"mm" vs "10mm") and can miss an otherwise-perfect
 * match purely over inconsistent spacing between a scanned bill and how the
 * product happens to be named in inventory — this sidesteps that without
 * needing a hardcoded list of units.
 */
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Dice coefficient over character bigrams — degrades gracefully for typos, abbreviations, and OCR noise instead of an all-or-nothing token match. */
function bigramDice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0
  const bigrams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2))
    return set
  }
  const setA = bigrams(a)
  const setB = bigrams(b)
  let overlap = 0
  for (const bg of setA) if (setB.has(bg)) overlap += 1
  return (2 * overlap) / (setA.size + setB.size)
}

/**
 * Fuzzy-matches a scanned/typed item name against the inventory. A scanned
 * name only has to be *relatable* to an existing product, not identical —
 * exact-ish matches used to require 60%+ token overlap, which a single
 * split/merged token (e.g. "10 mm" on the bill vs "10mm" in inventory) or a
 * shortened word (e.g. "Ply" vs "Plywood") could easily drop below, wrongly
 * routing a real, findable product into "new product" instead. Combines
 * word-overlap (order-insensitive), a no-space-normalized substring check
 * (handles spacing/punctuation drift and common prefix abbreviations), and
 * character-bigram similarity (handles minor OCR/typo noise) — the best of
 * the three signals decides the match, so it only takes one to line up.
 */
export function findBestProductMatch(name: string, products: Product[]): Product | undefined {
  const scan = tokenize(name)
  if (!scan.length) return undefined
  const scanSet = new Set(scan)
  const scanSquash = squash(name)

  let best: { product: Product; score: number } | undefined
  for (const product of products) {
    // Include `spec` in what's compared against — real descriptive words
    // (finish, grade, color) sometimes live only there, not in `name`.
    const productText = [product.name, product.spec].filter(Boolean).join(' ')
    const prod = tokenize(productText)
    if (!prod.length) continue
    const prodSet = new Set(prod)

    const inter = [...scanSet].filter((t) => prodSet.has(t)).length
    const union = new Set([...scanSet, ...prodSet]).size
    const jaccard = union ? inter / union : 0
    // Order-insensitive: every scanned token (2+) already present in the
    // product means the scan doesn't contradict it, even with extra words.
    const scanFullyIn = scan.length >= 2 && scan.every((t) => prodSet.has(t))

    const prodSquash = squash(productText)
    const containment =
      scanSquash.length >= 4 && prodSquash.length >= 4 &&
      (prodSquash.includes(scanSquash) || scanSquash.includes(prodSquash))
    const dice = bigramDice(scanSquash, prodSquash)

    const score = Math.max(jaccard, dice, containment ? 1 : 0)
    if ((score >= 0.45 || scanFullyIn) && (!best || score > best.score)) {
      best = { product, score }
    }
  }
  return best?.product
}
