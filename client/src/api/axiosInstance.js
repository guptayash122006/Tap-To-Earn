import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send HTTP-Only refresh cookies
})

// Request Interceptor: Attach access token to headers
axiosInstance.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch (e) {
      console.error('[Axios] Error reading accessToken from localStorage:', e)
    }
    return config
  },
  (error) => Promise.reject(error)
)

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Response Interceptor: Intercept 401s, perform refresh token rotation, and retry requests
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Avoid loops or attempts on login/register/refresh
      if (
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/register') ||
        originalRequest.url.includes('/auth/refresh')
      ) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return axiosInstance(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const { accessToken } = response.data.data

        localStorage.setItem('accessToken', accessToken)

        // Dyn import authStore to update state without circular dep issues
        const { setAccessToken } = (await import('../store/authStore.js')).default.getState()
        setAccessToken(accessToken)

        processQueue(null, accessToken)
        isRefreshing = false

        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        isRefreshing = false

        localStorage.removeItem('accessToken')
        try {
          const { logoutState } = (await import('../store/authStore.js')).default.getState()
          logoutState()
        } catch (e) {
          console.error('[Axios] Error executing logoutState in store:', e)
        }

        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
