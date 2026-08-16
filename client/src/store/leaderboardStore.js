import { create } from 'zustand'
import leaderboardApi from '../api/leaderboardApi.js'

const useLeaderboardStore = create((set) => ({
  leaderboard: [],
  userRank: null,
  loading: false,
  error: null,

  fetchLeaderboard: async (period = 'allTime', limit = 100) => {
    set({ loading: true, error: null })
    try {
      const response = await leaderboardApi.getLeaderboard(period, limit)
      const { leaderboard, userRank } = response.data.data
      set({
        leaderboard: leaderboard || [],
        userRank: userRank || null,
        loading: false,
      })
    } catch (err) {
      console.error('[LeaderboardStore] Fetch error:', err)
      const msg = err.response?.data?.message || 'Failed to fetch leaderboard.'
      set({ loading: false, error: msg })
    }
  },
}))

export default useLeaderboardStore
export { useLeaderboardStore }
