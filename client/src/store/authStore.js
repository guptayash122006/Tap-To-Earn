import { create } from 'zustand'
import authApi from '../api/authApi.js'

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken') || null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  loading: true,
  error: null,

  setAccessToken: (token) => {
    if (token) {
      localStorage.setItem('accessToken', token)
      set({ accessToken: token, isAuthenticated: true })
    } else {
      localStorage.removeItem('accessToken')
      set({ accessToken: null, isAuthenticated: false, user: null })
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const response = await authApi.login(email, password)
      const { user, accessToken } = response.data.data
      localStorage.setItem('accessToken', accessToken)
      set({ user, accessToken, isAuthenticated: true, loading: false })
      return { success: true, user }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed.'
      set({ loading: false, error: msg })
      return { success: false, error: msg }
    }
  },

  register: async (username, email, password, referralCode) => {
    set({ loading: true, error: null })
    try {
      const response = await authApi.register(username, email, password, referralCode)
      const { user, accessToken } = response.data.data
      localStorage.setItem('accessToken', accessToken)
      set({ user, accessToken, isAuthenticated: true, loading: false })
      return { success: true, user }
    } catch (err) {
      let msg = err.response?.data?.message || 'Registration failed.'
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        msg = err.response.data.errors.map(e => e.message).join(' ')
      }
      set({ loading: false, error: msg })
      return { success: false, error: msg }
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await authApi.logout()
    } catch (err) {
      console.error('[AuthStore] Logout API error:', err)
    } finally {
      localStorage.removeItem('accessToken')
      set({ user: null, accessToken: null, isAuthenticated: false, loading: false })
    }
  },

  logoutState: () => {
    localStorage.removeItem('accessToken')
    set({ user: null, accessToken: null, isAuthenticated: false, loading: false })
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      set({ loading: false, isAuthenticated: false, user: null })
      return
    }
    set({ loading: true, error: null })
    try {
      const response = await authApi.getMe()
      const { user, wallet } = response.data.data
      const userWithWallet = { ...user, wallet }
      set({ user: userWithWallet, isAuthenticated: true, loading: false })
    } catch (err) {
      console.error('[AuthStore] checkAuth error:', err)
      // Axios interceptor will handle token rotation.
      set({ loading: false })
    }
  },

  updateUserWallet: (updatedWallet) => {
    const currentUser = get().user
    if (currentUser) {
      set({ user: { ...currentUser, wallet: updatedWallet } })
    }
  },
}))

export default useAuthStore
