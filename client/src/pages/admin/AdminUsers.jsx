import React, { useState, useEffect } from 'react'
import { Search, ShieldAlert, Coins, Check, X, AlertCircle } from 'lucide-react'
import adminApi from '../../api/adminApi.js'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'

const AdminUsers = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Action state (for modally editing a user inline)
  const [activeUserId, setActiveUserId] = useState(null)
  const [actionType, setActionType] = useState('') // 'ban' or 'coins'
  const [banReason, setBanReason] = useState('')
  const [coinAmount, setCoinAmount] = useState('')
  const [coinReason, setCoinReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchUsersList = async (pageIndex, queryStr, status) => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers({
        page: pageIndex,
        limit: 15,
        search: queryStr || undefined,
        status: status || undefined,
      })
      setUsers(res.data.data.users || [])
      setTotalPages(res.data.data.pagination?.totalPages || 1)
      setPage(pageIndex)
    } catch (err) {
      toast.error('Failed to load users list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsersList(1, search, statusFilter)
  }, [statusFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchUsersList(1, search, statusFilter)
  }

  const handleBan = async (id) => {
    if (!banReason.trim()) {
      toast.error('Please enter a reason for banning.')
      return
    }

    setActionLoading(true)
    try {
      const res = await adminApi.banUser(id, banReason.trim())
      toast.success(res.data.message || 'User banned successfully!')
      setActiveUserId(null)
      setBanReason('')
      fetchUsersList(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ban failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnban = async (id) => {
    if (!window.confirm('Are you sure you want to unban this user?')) return

    setActionLoading(true)
    try {
      const res = await adminApi.unbanUser(id)
      toast.success(res.data.message || 'User unbanned successfully!')
      fetchUsersList(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unban failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdjustCoins = async (id) => {
    const amount = parseInt(coinAmount, 10)
    if (isNaN(amount) || amount === 0) {
      toast.error('Please enter a valid non-zero integer amount.')
      return
    }
    if (!coinReason.trim()) {
      toast.error('Please enter a justification reason.')
      return
    }

    setActionLoading(true)
    try {
      const res = await adminApi.adjustCoins(id, amount, coinReason.trim())
      toast.success(res.data.message || 'Coins adjusted successfully!')
      setActiveUserId(null)
      setCoinAmount('')
      setCoinReason('')
      fetchUsersList(page, search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Adjustment failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  return (
    <div className="admin-users-page fade-in">
      <div className="page-header-row">
        <h2>Manage Users</h2>
        <p className="subtitle">Search profiles, ban/unban users, and adjust coin balances</p>
      </div>

      {/* Control panel and filters */}
      <div className="card glass-card filters-card mb-6">
        <div className="card-body flex justify-between items-center flex-wrap gap-4">
          <form onSubmit={handleSearchSubmit} className="search-form-flex">
            <input
              type="text"
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn btn-secondary flex items-center gap-1">
              <Search size={14} /> Search
            </button>
          </form>

          <div className="status-selector-flex">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="banned">Banned Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card glass-card users-table-card">
        <div className="card-body relative min-h-[400px]">
          {loading && (
            <div className="list-loading-overlay">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!loading && users.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No Users Found"
              description="No user profiles matched your filters."
            />
          ) : (
            !loading && (
              <>
                <div className="table-responsive">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Taps</th>
                        <th>Power</th>
                        <th>Wallet Balance</th>
                        <th>Date Registered</th>
                        <th style={{ width: '220px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((item) => (
                        <React.Fragment key={item._id}>
                          <tr>
                            <td className="font-semibold">{item.username}</td>
                            <td className="text-sm">{item.email}</td>
                            <td>
                              <span className={`status-pill ${item.status}`}>
                                {item.status}
                              </span>
                            </td>
                            <td>{formatNumber(item.totalTaps)}</td>
                            <td>{item.tapPower}</td>
                            <td className="gold font-semibold">
                              {formatNumber(item.totalCoins)}
                            </td>
                            <td className="text-sm">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </td>
                            <td>
                              <div className="actions-flex gap-2">
                                <button
                                  onClick={() => {
                                    setActiveUserId(item._id)
                                    setActionType('coins')
                                  }}
                                  className="btn btn-secondary btn-sm flex items-center gap-1 text-gold"
                                >
                                  <Coins size={12} /> Balance
                                </button>

                                {item.status === 'banned' ? (
                                  <button
                                    onClick={() => handleUnban(item._id)}
                                    className="btn btn-secondary btn-sm flex items-center gap-1 text-green"
                                  >
                                    <Check size={12} /> Unban
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setActiveUserId(item._id)
                                      setActionType('ban')
                                    }}
                                    className="btn btn-secondary btn-sm flex items-center gap-1 text-red"
                                  >
                                    <ShieldAlert size={12} /> Ban
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Action Sub-form Dropdown (inline edit panels) */}
                          {activeUserId === item._id && (
                            <tr className="action-row-dropdown">
                              <td colSpan="8">
                                <div className="action-card-nested border-gold">
                                  {actionType === 'ban' ? (
                                    <div className="form-panel-flex">
                                      <div className="meta">
                                        <h4>Ban User: @{item.username}</h4>
                                        <p>Specify a policy reason for banning this user</p>
                                      </div>
                                      <div className="inputs-row">
                                        <input
                                          type="text"
                                          placeholder="Enter ban reason..."
                                          value={banReason}
                                          onChange={(e) => setBanReason(e.target.value)}
                                        />
                                        <button
                                          onClick={() => handleBan(item._id)}
                                          disabled={actionLoading}
                                          className="btn btn-danger btn-sm"
                                        >
                                          Confirm Ban
                                        </button>
                                        <button
                                          onClick={() => setActiveUserId(null)}
                                          className="btn btn-secondary btn-sm"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="form-panel-flex">
                                      <div className="meta">
                                        <h4>Adjust Coins: @{item.username}</h4>
                                        <p>Use positive values to grant, negative values to deduct</p>
                                      </div>
                                      <div className="inputs-row">
                                        <input
                                          type="number"
                                          placeholder="Amount (e.g. 500 or -500)"
                                          value={coinAmount}
                                          onChange={(e) => setCoinAmount(e.target.value)}
                                        />
                                        <input
                                          type="text"
                                          placeholder="Auditing Note..."
                                          value={coinReason}
                                          onChange={(e) => setCoinReason(e.target.value)}
                                        />
                                        <button
                                          onClick={() => handleAdjustCoins(item._id)}
                                          disabled={actionLoading}
                                          className="btn btn-primary btn-sm"
                                        >
                                          Apply Change
                                        </button>
                                        <button
                                          onClick={() => setActiveUserId(null)}
                                          className="btn btn-secondary btn-sm"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="table-pagination-row">
                    <button
                      disabled={page === 1 || loading}
                      onClick={() => fetchUsersList(page - 1, search, statusFilter)}
                      className="btn btn-secondary btn-sm"
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages || loading}
                      onClick={() => fetchUsersList(page + 1, search, statusFilter)}
                      className="btn btn-secondary btn-sm"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminUsers
