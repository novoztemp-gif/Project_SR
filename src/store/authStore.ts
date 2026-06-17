import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { http, setToken } from '@/lib/apiClient'
import type { AuthUser, Section } from '@/types'

interface LoginResponse {
  token: string
  user: AuthUser
}

interface AuthState {
  currentUser: AuthUser | null
  /** 'loading' while restoring a session on app start. */
  status: 'idle' | 'loading' | 'ready'
  login: (userId: string, password: string) => Promise<AuthUser>
  logout: () => void
  hasAccessTo: (section: Section) => boolean
  /** Verify a persisted token on app start and refresh the user. */
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      status: 'idle',

      login: async (userId, password) => {
        const { token, user } = await http.post<LoginResponse>('/auth/login', {
          userId,
          password,
        })
        setToken(token)
        set({ currentUser: user, status: 'ready' })
        return user
      },

      logout: () => {
        setToken(null)
        set({ currentUser: null, status: 'ready' })
      },

      hasAccessTo: (section) => {
        const { currentUser } = get()
        return currentUser?.sections.includes(section) ?? false
      },

      initialize: async () => {
        set({ status: 'loading' })
        try {
          // Re-validate the token (if any) and refresh the user record.
          const user = await http.get<AuthUser>('/auth/me')
          set({ currentUser: user, status: 'ready' })
        } catch {
          setToken(null)
          set({ currentUser: null, status: 'ready' })
        }
      },
    }),
    {
      name: 'billing-app-auth',
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
)
