import axiosInstance from './axiosInstance.js'

export const getLeaderboard = (period = 'allTime', limit = 100) => {
  return axiosInstance.get('/leaderboard', {
    params: { period, limit },
  })
}

const leaderboardApi = {
  getLeaderboard,
}

export default leaderboardApi
