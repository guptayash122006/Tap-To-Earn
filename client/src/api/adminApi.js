import axiosInstance from './axiosInstance.js'

export const getDashboard = () => {
  return axiosInstance.get('/admin/dashboard')
}

export const getAnalytics = (days = 7) => {
  return axiosInstance.get('/admin/analytics', { params: { days } })
}

export const getLogs = (page = 1, limit = 50) => {
  return axiosInstance.get('/admin/logs', { params: { page, limit } })
}

export const getUsers = (params = {}) => {
  return axiosInstance.get('/admin/users', { params })
}

export const getUser = (id) => {
  return axiosInstance.get(`/admin/users/${id}`)
}

export const banUser = (id, reason) => {
  return axiosInstance.patch(`/admin/users/${id}/ban`, { reason })
}

export const unbanUser = (id) => {
  return axiosInstance.patch(`/admin/users/${id}/unban`)
}

export const adjustCoins = (id, amount, reason) => {
  return axiosInstance.patch(`/admin/users/${id}/coins`, { amount, reason })
}

export const getWithdrawals = (params = {}) => {
  return axiosInstance.get('/admin/withdrawals', { params })
}

export const approveWithdrawal = (id, txnRef, note) => {
  return axiosInstance.patch(`/admin/withdrawals/${id}/approve`, { txnRef, note })
}

export const rejectWithdrawal = (id, reason) => {
  return axiosInstance.patch(`/admin/withdrawals/${id}/reject`, { reason })
}

export const processWithdrawal = (id, note) => {
  return axiosInstance.patch(`/admin/withdrawals/${id}/processing`, { note })
}

export const getTransactions = (params = {}) => {
  return axiosInstance.get('/admin/transactions', { params })
}

const adminApi = {
  getDashboard,
  getAnalytics,
  getLogs,
  getUsers,
  getUser,
  banUser,
  unbanUser,
  adjustCoins,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  processWithdrawal,
  getTransactions,
}

export default adminApi
