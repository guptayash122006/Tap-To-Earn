import React, { useState, useEffect } from 'react'
import { History, TrendingUp, TrendingDown, ArrowUpRight, Clock, AlertCircle } from 'lucide-react'
import transactionApi from '../api/transactionApi.js'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import EmptyState from '../components/common/EmptyState.jsx'

const TransactionHistory = () => {
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterType, setFilterType] = useState('') // all, or tap, referral_bonus, daily_reward, task_reward, withdrawal, withdrawal_refund, admin_grant, admin_deduct

  const fetchTxs = async (pageIndex, type) => {
    setLoading(true)
    try {
      const response = await transactionApi.getTransactions(pageIndex, 15, type || undefined)
      setTxs(response.data.data.transactions || [])
      setTotalPages(response.data.data.pagination?.pages || 1)
      setPage(pageIndex)
    } catch (err) {
      console.error('[TransactionHistory] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTxs(1, filterType)
  }, [filterType])

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  const getTypeIcon = (category) => {
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
    <div className="tx-history-page fade-in">
      <div className="page-header-row">
        <h2>Ledger Logs</h2>
        <p className="subtitle">Audit history of every coin credited or debited on your account</p>
      </div>

      {/* Filter and Table Card */}
      <div className="card glass-card history-table-card">
        <div className="card-header flex justify-between items-center flex-wrap gap-4">
          <h3>Ledger Audit List</h3>

          <div className="filter-controls">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="">All Transactions</option>
              <option value="tap">Tapping Earned</option>
              <option value="daily_reward">Streak Claims</option>
              <option value="referral_bonus">Invite Payouts</option>
              <option value="withdrawal">Cash Outs</option>
              <option value="admin_grant">Admin Grants</option>
            </select>
          </div>
        </div>

        <div className="card-body relative min-h-[300px]">
          {loading && (
            <div className="list-loading-overlay">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!loading && txs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Ledger History"
              description="No ledger transactions correspond to your select filter query."
            />
          ) : (
            !loading && (
              <>
                <div className="table-responsive">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Flow</th>
                        <th>Ledger Category</th>
                        <th>Details/Description</th>
                        <th>Balance Change</th>
                        <th>Balance After</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((tx) => {
                        const isCredit = tx.category === 'credit'
                        return (
                          <tr key={tx._id}>
                            <td>{getTypeIcon(tx.category)}</td>
                            <td>
                              <span className="font-semibold text-capitalize">
                                {getCleanTypeName(tx.type)}
                              </span>
                            </td>
                            <td className="text-sm truncate max-w-sm">{tx.description}</td>
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
                      onClick={() => fetchTxs(page - 1, filterType)}
                      className="btn btn-secondary btn-sm"
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages || loading}
                      onClick={() => fetchTxs(page + 1, filterType)}
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

export default TransactionHistory
