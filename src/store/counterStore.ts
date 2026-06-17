import { create } from 'zustand'

import { http } from '@/lib/apiClient'
import type { AuthUser, BillingRole, SectionType } from '@/types'

export interface Counter {
  id: string
  name: string
  initials: string
  label: string
  role: BillingRole
  process: SectionType[]
  avatarColor: string
  active: boolean
}

type CounterInput = {
  name: string
  label: string
  process: SectionType[]
  active: boolean
}

/** Map the backend's public user shape onto the Counter the UI expects. */
function toCounter(user: AuthUser): Counter {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials ?? '',
    label: user.label ?? '',
    role: user.role as BillingRole,
    process: user.process,
    avatarColor: user.avatarColor ?? 'deep',
    active: user.active,
  }
}

interface CounterState {
  counters: Counter[]
  hydrated: boolean
  hydrate: () => Promise<void>
  addCounter: (data: CounterInput) => Promise<Counter>
  updateCounter: (id: string, data: CounterInput) => Promise<void>
  deleteCounter: (id: string) => Promise<void>
  reorderCounters: (ids: string[]) => Promise<void>
}

export const useCounterStore = create<CounterState>()((set) => ({
  counters: [],
  hydrated: false,

  hydrate: async () => {
    const users = await http.get<AuthUser[]>('/counters')
    set({ counters: users.map(toCounter), hydrated: true })
  },

  addCounter: async (data) => {
    const user = await http.post<AuthUser>('/counters', data)
    const counter = toCounter(user)
    set((state) => ({ counters: [...state.counters, counter] }))
    return counter
  },

  updateCounter: async (id, data) => {
    const user = await http.put<AuthUser>(`/counters/${id}`, data)
    set((state) => ({
      counters: state.counters.map((c) => (c.id === id ? toCounter(user) : c)),
    }))
  },

  deleteCounter: async (id) => {
    await http.del(`/counters/${id}`)
    set((state) => ({
      counters: state.counters.map((c) => (c.id === id ? { ...c, active: false } : c)),
    }))
  },

  reorderCounters: async (ids) => {
    set((state) => {
      const byId = new Map(state.counters.map((c) => [c.id, c]))
      return {
        counters: [
          ...ids.map((id) => byId.get(id)).filter((c): c is Counter => Boolean(c)),
          ...state.counters.filter((c) => !ids.includes(c.id)),
        ],
      }
    })
    await http.put('/counters/reorder/all', { ids })
  },
}))
