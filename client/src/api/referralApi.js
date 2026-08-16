import axiosInstance from './axiosInstance.js'

export const validateCode = (code) => {
  return axiosInstance.post('/referral/validate', { code })
}

export const getMyCode = () => {
  return axiosInstance.get('/referral/code')
}

export const getStats = () => {
  return axiosInstance.get('/referral/stats')
}

export const getList = (page = 1, limit = 20) => {
  return axiosInstance.get('/referral/list', {
    params: { page, limit },
  })
}

const referralApi = {
  validateCode,
  getMyCode,
  getStats,
  getList,
}

export default referralApi
