import React, { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import useAuthStore from './store/authStore.js'
import AppRouter from './router/AppRouter.jsx'
import './styles/variables.css'
import './styles/index.css'
import './styles/animations.css'

const App = () => {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <>
      <AppRouter />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#0e1120',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontFamily: 'inherit',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#0e1120',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#0e1120',
            },
          },
        }}
      />
    </>
  )
}

export default App
