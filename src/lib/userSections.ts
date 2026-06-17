import { SECTIONS } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import { useCounterStore } from '@/store/counterStore'
import type { Role, Section } from '@/types'

export function getAllSections(): Section[] {
  return SECTIONS.map((section) => section.key)
}

/**
 * Sections the given user may access. In practice this is only ever called for
 * the currently-logged-in user, whose accessible sections are attached to the
 * auth record by the backend.
 */
export function getUserSections(userId: string): Section[] {
  const current = useAuthStore.getState().currentUser
  if (current && current.id === userId) return current.sections
  // Fallback for admin inspecting a known counter from the hydrated cache.
  return []
}

export function isBillingRole(role: Role) {
  return role.startsWith('billing_')
}

/** Best-effort display name for a bill/purchase creator id. */
export function getUserName(userId: string): string {
  const current = useAuthStore.getState().currentUser
  if (current && current.id === userId) return current.name
  const counter = useCounterStore.getState().counters.find((c) => c.id === userId)
  return counter?.name ?? userId
}
