import axiosInstance from './axiosInstance.js'

export const getSummary = () => {
  return axiosInstance.get('/withdrawal/summary')
}

export const getHistory = (page = 1, limit = 10, status) => {
  return axiosInstance.get('/withdrawal/history', {
    params: { page, limit, status },
  })
}

export const submitWithdrawal = (coinsRequested, paymentMethod, paymentDetails) => {
  return axiosInstance.post('/withdrawal', {
    coinsRequested,
    paymentMethod,
    paymentDetails,
  })
}

export const cancelWithdrawal = (id) => {
  return axiosInstance.delete(`/withdrawal/${id}/cancel`)
}

const withdrawalApi = {
  getSummary,
  getHistory,
  submitWithdrawal,
  cancelWithdrawal,
}

export default withdrawalApi
