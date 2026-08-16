import axiosInstance from './axiosInstance.js'

export const getTransactions = (page = 1, limit = 20, type) => {
  return axiosInstance.get('/transactions', {
    params: { page, limit, type },
  })
}

const transactionApi = {
  getTransactions,
}

export default transactionApi
