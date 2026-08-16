import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Users, Coins, Wallet, History, AlertCircle, Award } from 'lucide-react'
import adminApi from '../../api/adminApi.js'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'

const AdminDashboard = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminApi.getDashboard()
      setStats(response.data.data)
    } catch (err) {
      console.error('[AdminDashboard] Fetch error:', err)
      setError(err.response?.data?.message || 'Failed to load administrative statistics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  if (loading) {
    return (
      <div className="page-loading-wrap">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card glass-card error-card fade-in">
        <AlertCircle size={32} />
        <h3>Access Denied / System Error</h3>
        <p>{error}</p>
        <button onClick={fetchStats} className="btn btn-primary mt-4">Retry Connection</button>
      </div>
    )
  }

  return (
    <div className="admin-dashboard-container fade-in">
      <div className="page-header-row">
        <h2>Admin Overview Dashboard</h2>
        <p className="subtitle">Real-time stats and control tools for the TapEarn application</p>
      </div>

      {/* Main Metrics Grid */}
      <div className="admin-metrics-grid">
        {/* User Card */}
        <div className="card glass-card admin-metric-item">
          <div className="item-header">
            <Users className="text-purple" />
            <span className="title">User Management</span>
          </div>
          <div className="item-body">
            <span className="value">{formatNumber(stats?.users?.total)}</span>
            <span className="desc">Total registered users</span>
            <div className="sub-breakdowns">
              <span>{formatNumber(stats?.users?.active)} Active</span>
              <span>{formatNumber(stats?.users?.banned)} Banned</span>
            </div>
          </div>
          <Link to="/admin/users" className="metric-action-btn">
            Manage Users →
          </Link>
        </div>

        {/* Coins Card */}
        <div className="card glass-card admin-metric-item">
          <div className="item-header">
            <Coins className="text-gold" />
            <span className="title">Coins Circulation</span>
          </div>
          <div className="item-body">
            <span className="value gold-glow-text">
              {formatNumber(stats?.coins?.totalInCirculation)}
            </span>
            <span className="desc">Coins in circulation</span>
            <div className="sub-breakdowns">
              <span>{formatNumber(stats?.coins?.tapsToday)} Taps Today</span>
              <span>+{formatNumber(stats?.coins?.coinsEarnedToday)} Today</span>
            </div>
          </div>
          <Link to="/admin/transactions" className="metric-action-btn">
            View Ledgers →
          </Link>
        </div>

        {/* Withdrawals Card */}
        <div className="card glass-card admin-metric-item">
          <div className="item-header">
            <Wallet className="text-green" />
            <span className="title">Pending Withdrawals</span>
          </div>
          <div className="item-body">
            <span className="value">
              {stats?.withdrawals?.pending > 0 ? (
                <span className="text-gold">{stats.withdrawals.pending} Pending</span>
              ) : (
                '0 Requests'
              )}
            </span>
            <span className="desc">Requires manual approval</span>
            <div className="sub-breakdowns">
              <span>Paid: {formatNumber(stats?.withdrawals?.totalApproved)} requests</span>
              <span>Valued at: ${stats?.withdrawals?.totalPaidUsd} USD</span>
            </div>
          </div>
          <Link to="/admin/withdrawals" className="metric-action-btn">
            Review Queue →
          </Link>
        </div>
      </div>

      <div className="admin-interactive-details-grid">
        {/* Top Earners */}
        <div className="card glass-card top-earners-card">
          <div className="card-header">
            <Award className="text-gold" />
            <h3>Top Earners Today</h3>
          </div>
          <div className="card-body">
            {stats?.topEarnersToday?.length === 0 ? (
              <p className="muted-text text-center py-6">No earnings logged today yet.</p>
            ) : (
              <ul className="earners-list">
                {stats?.topEarnersToday?.map((earner, idx) => (
                  <li key={earner.username}>
                    <span className="earner-rank">#{idx + 1}</span>
                    <span className="earner-name">{earner.username}</span>
                    <span className="earner-coins">+{formatNumber(earner.earnedToday)} coins</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Quick controls info */}
        <div className="card glass-card quick-controls-card">
          <div className="card-header">
            <Shield className="text-purple" />
            <h3>Administrative Quick Commands</h3>
          </div>
          <div className="card-body">
            <p className="desc mb-4">
              As an administrator, you have access to the ledger entries, users database table, and the
              withdrawal queue table. Please perform audits before approving payments.
            </p>
            <div className="quick-links-group">
              <Link to="/admin/users" className="btn btn-secondary btn-sm btn-block mb-2">
                Ban, Unban or Grant Coins to User
              </Link>
              <Link to="/admin/withdrawals" className="btn btn-secondary btn-sm btn-block">
                Approve or Reject Payout Request
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
