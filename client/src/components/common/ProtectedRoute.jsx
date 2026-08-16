import React, { useEffect } from 'react'
import { Navigate, NavLink } from 'react-router-dom'
import { Home, Share2, Calendar, Trophy, Wallet } from 'lucide-react'
import useAuthStore from '../../store/authStore.js'
import ROUTES from '../../router/routes.js'
import LoadingSpinner from './LoadingSpinner.jsx'
import Sidebar from './Sidebar.jsx'
import Navbar from './Navbar.jsx'

const BottomNav = () => {
  return (
    <nav className="mobile-bottom-nav">
      <NavLink to={ROUTES.DASHBOARD} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Home className="nav-icon" />
        <span>Tap</span>
      </NavLink>
      <NavLink to={ROUTES.REFERRAL} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Share2 className="nav-icon" />
        <span>Invite</span>
      </NavLink>
      <NavLink to={ROUTES.DAILY_REWARD} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Calendar className="nav-icon" />
        <span>Streak</span>
      </NavLink>
      <NavLink to={ROUTES.LEADERBOARD} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Trophy className="nav-icon" />
        <span>Ranks</span>
      </NavLink>
      <NavLink to={ROUTES.WITHDRAW} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Wallet className="nav-icon" />
        <span>Payout</span>
      </NavLink>
    </nav>
  )
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, checkAuth } = useAuthStore()

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

  return (
    <div className="app-layout">
      {/* Premium Web3 Dark Background Orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      <Sidebar />
      <div className="app-main">
        <Navbar />
        <main className="app-content">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

export default ProtectedRoute
