import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cheap content equality for the small arrays this app polls (products,
 * bills, purchases — each well under a few hundred rows). A poll tick
 * fetches a brand-new array/object every time even when nothing on the
 * server actually changed, and a zustand `set()` with a new reference
 * re-renders every subscribed component regardless of whether the
 * content differs — on a 2s poll interval across several open tabs, that
 * churn alone becomes a visible drag on the whole page, not the network
 * round-trip. Comparing serialized content first lets a poller skip the
 * `set()` (and the re-render it would cause) on the common case where
 * polling simply confirmed nothing changed.
 */
export function sameContent<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
