import { create } from 'zustand'

interface AuthStore {
  isLoggedIn: boolean
  username: string
  login: () => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  isLoggedIn: false,
  username: 'User',
  login: () => {
    set({ isLoggedIn: true })
  },
  logout: () => {
    set({ isLoggedIn: false })
  }
}))

