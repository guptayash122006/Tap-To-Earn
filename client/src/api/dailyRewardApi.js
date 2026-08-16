import axiosInstance from './axiosInstance.js'

export const getRewardStatus = () => {
  return axiosInstance.get('/daily-reward/status')
}

export const claimReward = () => {
  return axiosInstance.post('/daily-reward/claim')
}

const dailyRewardApi = {
  getRewardStatus,
  claimReward,
}

export default dailyRewardApi
