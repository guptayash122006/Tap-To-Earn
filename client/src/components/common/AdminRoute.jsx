import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import ROUTES from '../../router/routes.js'
import LoadingSpinner from './LoadingSpinner.jsx'
import Sidebar from './Sidebar.jsx'
import Navbar from './Navbar.jsx'

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="fullscreen-loading">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (user?.role !== 'admin') {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return (
    <div className="app-layout admin-layout">
      {/* Background decoration */}
      <div className="bg-orb bg-orb-1" style={{ opacity: 0.05 }}></div>
      <div className="bg-orb bg-orb-2" style={{ opacity: 0.05 }}></div>

      <Sidebar isAdminPanel={true} />
      <div className="app-main">
        <Navbar isAdminPanel={true} />
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AdminRoute
