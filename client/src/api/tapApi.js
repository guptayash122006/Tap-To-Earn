import axiosInstance from './axiosInstance.js'

export const registerTap = (payload) => {
  return axiosInstance.post('/tap', payload)
}

export const getTapStatus = () => {
  return axiosInstance.get('/tap/status')
}

const tapApi = {
  registerTap,
  getTapStatus,
}

export default tapApi
