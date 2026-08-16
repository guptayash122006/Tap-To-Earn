import axiosInstance from './axiosInstance.js'

export const login = (email, password) => {
  return axiosInstance.post('/auth/login', { email, password })
}

export const register = (username, email, password, referralCode) => {
  const data = {
    username,
    email,
    password,
    confirmPassword: password,
  }
  if (referralCode && referralCode.trim() !== '') {
    data.referralCode = referralCode.trim()
  }
  return axiosInstance.post('/auth/register', data)
}

export const logout = () => {
  return axiosInstance.post('/auth/logout')
}

export const getMe = () => {
  return axiosInstance.get('/auth/me')
}

export const changePassword = (currentPassword, newPassword) => {
  return axiosInstance.put('/auth/change-password', { currentPassword, newPassword })
}

const authApi = {
  login,
  register,
  logout,
  getMe,
  changePassword,
}

export default authApi
