import { create } from 'zustand'
import tapApi from '../api/tapApi.js'
import useAuthStore from './authStore.js'

let syncTimeout = null

const useTapStore = create((set, get) => ({
  coins: 0,
  energy: 100,
  maxEnergy: 100,
  tapPower: 1,
  todayTaps: 0,
  lifetimeRemaining: 50000,
  loading: false,
  error: null,

  // Batching state
  pendingTaps: 0,
  tapIntervals: [],
  lastTapTime: null,
  sessionId: Math.random().toString(36).substring(2, 15),

  setInitialState: (user) => {
    if (user) {
      set({
        coins: user.wallet?.availableBalance || 0,
        energy: user.energy || 0,
        maxEnergy: user.maxEnergy || 100,
        tapPower: user.tapPower || 1,
        todayTaps: user.wallet?.tapsToday || 0,
      })
    }
  },

  tap: () => {
    const { energy, tapPower, pendingTaps, lastTapTime, tapIntervals } = get()

    if (energy <= 0) {
      return false // Insufficient energy
    }

    const now = Date.now()
    const interval = lastTapTime ? Math.min(1000, now - lastTapTime) : 100
    const newIntervals = [...tapIntervals, interval]
    const nextPending = pendingTaps + 1

    // Optimistic frontend updates
    set({
      energy: Math.max(0, energy - 1),
      pendingTaps: nextPending,
      tapIntervals: newIntervals,
      lastTapTime: now,
    })

    // If batch limit reached (max 10), sync immediately
    if (nextPending >= 10) {
      if (syncTimeout) clearTimeout(syncTimeout)
      get().syncTaps()
    } else {
      // Debounce and sync after user stops tapping
      if (syncTimeout) clearTimeout(syncTimeout)
      syncTimeout = setTimeout(() => {
        get().syncTaps()
      }, 800)
    }

    return true
  },

  syncTaps: async () => {
    const { pendingTaps, tapIntervals, sessionId, energy } = get()
    if (pendingTaps === 0) return

    // Clear batch variables locally before request to prevent duplicate syncs
    set({
      pendingTaps: 0,
      tapIntervals: [],
      lastTapTime: null,
    })

    try {
      const response = await tapApi.registerTap({
        tapCount: pendingTaps,
        sessionId,
        clientTimestamp: new Date().toISOString(),
        tapIntervals,
        energyAtClient: energy,
      })

      const { newTotalCoins, newEnergy, todayTaps, lifetimeTapsRemaining } = response.data.data

      // Update state
      set({
        coins: newTotalCoins,
        energy: newEnergy,
        todayTaps: todayTaps !== undefined ? todayTaps : get().todayTaps,
        lifetimeRemaining: lifetimeTapsRemaining !== undefined ? lifetimeTapsRemaining : get().lifetimeRemaining,
      })

      // Sync wallet values back into authStore
      const authUser = useAuthStore.getState().user
      if (authUser && authUser.wallet) {
        useAuthStore.getState().updateUserWallet({
          ...authUser.wallet,
          availableBalance: newTotalCoins,
        })
      }
    } catch (err) {
      console.error('[TapStore] Tap sync failed:', err)
      const errMsg = err.response?.data?.message || 'Tap sync failed.'
      set({ error: errMsg })

      // Rollback to server numbers
      get().fetchStatus()
    }
  },

  fetchStatus: async () => {
    set({ loading: true })
    try {
      const response = await tapApi.getTapStatus()
      const data = response.data.data
      set({
        energy: data.energy,
        maxEnergy: data.maxEnergy,
        tapPower: data.tapPower,
        todayTaps: data.todayTaps,
        lifetimeRemaining: data.lifetimeTapsRemaining,
        loading: false,
      })

      const authUser = useAuthStore.getState().user
      if (authUser && authUser.wallet) {
        set({ coins: authUser.wallet.availableBalance })
      }
    } catch (err) {
      set({ loading: false, error: 'Failed to fetch tap status.' })
    }
  },
}))

export default useTapStore
export { useTapStore }
