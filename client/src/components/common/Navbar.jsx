import React from 'react'
import useAuthStore from '../../store/authStore.js'
import Avatar from './Avatar.jsx'
import { Coins } from 'lucide-react'

const Navbar = ({ isAdminPanel = false }) => {
  const { user } = useAuthStore()

  const formatCoins = (val) => {
    return new Intl.NumberFormat('en-US').format(val || 0)
  }

  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <h1 className="page-title-heading">
          {isAdminPanel ? 'Admin Console' : `Hello, ${user?.username || 'Player'} 👋`}
        </h1>
      </div>

      <div className="navbar-right">
        {!isAdminPanel && user?.wallet && (
          <div className="navbar-balance-card">
            <Coins className="gold-coin-icon" />
            <span className="balance-amount">{formatCoins(user.wallet.availableBalance)}</span>
            <span className="balance-label">Coins</span>
          </div>
        )}
        <div className="navbar-profile-trigger">
          <Avatar username={user?.username} src={user?.avatar} size="sm" />
          <span className="navbar-username">{user?.username}</span>
          {user?.role === 'admin' && <span className="admin-role-badge">Admin</span>}
        </div>
      </div>
    </header>
  )
}

export default Navbar
