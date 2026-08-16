import React, { useState, useEffect } from 'react'
import { History, TrendingUp, TrendingDown, Search } from 'lucide-react'
import adminApi from '../../api/adminApi.js'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'

const AdminTransactions = () => {
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')

  const fetchGlobalTransactions = async (pageIndex, type, category, userId) => {
    setLoading(true)
    try {
      const res = await adminApi.getTransactions({
        page: pageIndex,
        limit: 15,
        type: type || undefined,
        category: category || undefined,
        userId: userId.trim() || undefined,
      })
      setTxs(res.data.data.transactions || [])
      setTotalPages(res.data.data.pagination?.pages || 1)
      setPage(pageIndex)
    } catch (err) {
      console.error('[AdminTransactions] Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGlobalTransactions(1, filterType, filterCategory, userIdFilter)
  }, [filterType, filterCategory])

  const handleUserIdSearch = (e) => {
    e.preventDefault()
    fetchGlobalTransactions(1, filterType, filterCategory, userIdFilter)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  const getFlowIcon = (category) => {
    if (category === 'credit') {
      return (
        <div className="tx-icon-wrap credit-wrap">
          <TrendingUp size={16} />
        </div>
      )
    }
    return (
      <div className="tx-icon-wrap debit-wrap">
        <TrendingDown size={16} />
      </div>
    )
  }

  const getCleanTypeName = (type) => {
    switch (type) {
      case 'tap':
        return 'Tapping Earned'
      case 'referral_bonus':
        return 'Invite Payout'
      case 'referral_join':
        return 'Welcome Invite'
      case 'daily_reward':
        return 'Streak Claim'
      case 'withdrawal':
        return 'Cash Out'
      case 'withdrawal_refund':
        return 'Cash Out Return'
      case 'admin_grant':
        return 'Admin Grant'
      case 'admin_deduct':
        return 'Admin Deduction'
      default:
        return type.replace('_', ' ')
    }
  }

  return (
    <div className="admin-transactions-page fade-in">
      <div className="page-header-row">
        <h2>Global System Ledgers</h2>
        <p className="subtitle">Audit logs for every wallet transaction across the entire platform</p>
      </div>

      {/* Filters Card */}
      <div className="card glass-card filters-card mb-6">
        <div className="card-body flex justify-between items-center flex-wrap gap-4">
          <form onSubmit={handleUserIdSearch} className="search-form-flex">
            <input
              type="text"
              placeholder="Search by User ID..."
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn btn-secondary flex items-center gap-1">
              <Search size={14} /> Filter User
            </button>
          </form>

          <div className="flex gap-2 flex-wrap">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="">All Types</option>
              <option value="tap">Tapping Earned</option>
              <option value="daily_reward">Streak Claims</option>
              <option value="referral_bonus">Invite Payouts</option>
              <option value="withdrawal">Cash Outs</option>
              <option value="admin_grant">Admin Grants</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="filter-select"
            >
              <option value="">All Flows</option>
              <option value="credit">Credits Only</option>
              <option value="debit">Debits Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="card glass-card history-table-card">
        <div className="card-body relative min-h-[300px]">
          {loading && (
            <div className="list-loading-overlay">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!loading && txs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Ledger Records"
              description="No transaction logs match your criteria."
            />
          ) : (
            !loading && (
              <>
                <div className="table-responsive">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Flow</th>
                        <th>User</th>
                        <th>Type</th>
                        <th>Details/Description</th>
                        <th>Amount</th>
                        <th>Balance After</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((tx) => {
                        const isCredit = tx.category === 'credit'
                        return (
                          <tr key={tx._id}>
                            <td>{getFlowIcon(tx.category)}</td>
                            <td className="font-semibold">
                              {tx.userId?.username || tx.userId || 'System'}
                            </td>
                            <td>
                              <span className="font-semibold text-capitalize">
                                {getCleanTypeName(tx.type)}
                              </span>
                            </td>
                            <td className="text-sm truncate max-w-xs">{tx.description}</td>
                            <td>
                              <span className={`font-semibold ${isCredit ? 'text-green' : 'text-red'}`}>
                                {isCredit ? '+' : '-'}
                                {formatNumber(tx.amount)}
                              </span>
                            </td>
                            <td>{formatNumber(tx.balanceAfter)} coins</td>
                            <td className="text-sm">
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="table-pagination-row">
                    <button
                      disabled={page === 1 || loading}
                      onClick={() =>
                        fetchGlobalTransactions(page - 1, filterType, filterCategory, userIdFilter)
                      }
                      className="btn btn-secondary btn-sm"
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages || loading}
                      onClick={() =>
                        fetchGlobalTransactions(page + 1, filterType, filterCategory, userIdFilter)
                      }
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

export default AdminTransactions
