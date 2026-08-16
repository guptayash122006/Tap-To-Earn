import React from 'react'
import { NavLink } from 'react-router-dom'
import { Zap, Share2, Gift, Trophy, Wallet, History, User, Shield, LogOut } from 'lucide-react'
import useAuthStore from '../../store/authStore.js'
import ROUTES from '../../router/routes.js'

const Sidebar = ({ isAdminPanel = false }) => {
  const { user, logout } = useAuthStore()

  const userNavigation = [
    { name: 'Tap Area', path: ROUTES.DASHBOARD, icon: Zap },
    { name: 'Invite Friends', path: ROUTES.REFERRAL, icon: Share2 },
    { name: 'Streak Bonus', path: ROUTES.DAILY_REWARD, icon: Gift },
    { name: 'Leaderboard', path: ROUTES.LEADERBOARD, icon: Trophy },
    { name: 'Withdraw Payout', path: ROUTES.WITHDRAW, icon: Wallet },
    { name: 'Ledger History', path: ROUTES.HISTORY, icon: History },
    { name: 'My Profile', path: ROUTES.PROFILE, icon: User },
  ]

  const adminNavigation = [
    { name: 'Admin Stats', path: ROUTES.ADMIN, icon: Shield },
    { name: 'Manage Users', path: `${ROUTES.ADMIN}/users`, icon: User },
    { name: 'Payout Requests', path: `${ROUTES.ADMIN}/withdrawals`, icon: Wallet },
    { name: 'System Ledgers', path: `${ROUTES.ADMIN}/transactions`, icon: History },
  ]

  const navItems = isAdminPanel ? adminNavigation : userNavigation

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <Zap className="logo-icon" />
        </div>
        <div className="brand-info">
          <span className="brand-name">TapEarn</span>
          <span className="brand-version">v1.0 MVP</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-group-label">{isAdminPanel ? 'Admin System' : 'Main Menu'}</span>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === ROUTES.DASHBOARD || item.path === ROUTES.ADMIN}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <item.icon className="link-icon" />
            <span>{item.name}</span>
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <div className="admin-toggle-section">
            <span className="nav-group-label">System Control</span>
            <NavLink
              to={isAdminPanel ? ROUTES.DASHBOARD : ROUTES.ADMIN}
              className="sidebar-link admin-toggle-btn"
            >
              <Shield className="link-icon" />
              <span>{isAdminPanel ? 'Back to Game' : 'Admin Panel'}</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button onClick={logout} className="sidebar-logout-btn">
          <LogOut className="link-icon" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
