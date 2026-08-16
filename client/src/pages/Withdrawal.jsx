import React, { useState, useEffect } from 'react'
import { Wallet, AlertTriangle, CheckCircle, Clock, XCircle, ArrowUpRight } from 'lucide-react'
import withdrawalApi from '../api/withdrawalApi.js'
import useAuthStore from '../store/authStore.js'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import EmptyState from '../components/common/EmptyState.jsx'

const Withdrawal = () => {
  const { user, updateUserWallet } = useAuthStore()
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Form State
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('usdt')
  const [details, setDetails] = useState('')

  const fetchSummaryAndHistory = async () => {
    setLoading(true)
    try {
      const summaryRes = await withdrawalApi.getSummary()
      setSummary(summaryRes.data.data)

      const historyRes = await withdrawalApi.getHistory(1, 10)
      setHistory(historyRes.data.data.requests || [])
      setTotalPages(historyRes.data.data.pagination?.totalPages || 1)
    } catch (err) {
      console.error('[Withdrawal] Load error:', err)
      toast.error('Failed to load wallet or withdrawal history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummaryAndHistory()
  }, [])

  const loadMoreHistory = async (nextPage) => {
    setHistoryLoading(true)
    try {
      const res = await withdrawalApi.getHistory(nextPage, 10)
      setHistory(res.data.data.requests || [])
      setPage(nextPage)
    } catch (err) {
      toast.error('Failed to load transaction history page.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const requestAmount = parseInt(amount, 10)
    const minCoins = summary?.minimumCoins || 1000

    if (!amount || isNaN(requestAmount) || requestAmount <= 0) {
      toast.error('Please enter a valid positive coin amount.')
      return
    }

    if (requestAmount < minCoins) {
      toast.error(`Minimum withdrawal amount is ${new Intl.NumberFormat().format(minCoins)} coins.`)
      return
    }

    if (requestAmount > (summary?.availableBalance || 0)) {
      toast.error('Insufficient available coins balance.')
      return
    }

    if (!details.trim()) {
      toast.error('Please enter your payout account destination details.')
      return
    }

    setActionLoading(true)
    try {
      const response = await withdrawalApi.submitWithdrawal(requestAmount, method, details.trim())
      toast.success(response.data.message || 'Withdrawal submitted successfully!')
      
      // Reset form
      setAmount('')
      setDetails('')

      // Reload summary and history
      await fetchSummaryAndHistory()
    } catch (err) {
      console.error('[Withdrawal] Submission error:', err)
      toast.error(err.response?.data?.message || 'Withdrawal request failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelRequest = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this pending withdrawal request?')) return

    setActionLoading(true)
    try {
      const response = await withdrawalApi.cancelWithdrawal(id)
      toast.success(response.data.message || 'Request cancelled successfully!')
      await fetchSummaryAndHistory()
    } catch (err) {
      console.error('[Withdrawal] Cancel error:', err)
      toast.error(err.response?.data?.message || 'Could not cancel request.')
    } finally {
      setActionLoading(false)
    }
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="status-pill pending">
            <Clock size={12} className="mr-1" /> Pending
          </span>
        )
      case 'processing':
        return (
          <span className="status-pill processing">
            <Clock size={12} className="mr-1" /> Processing
          </span>
        )
      case 'approved':
        return (
          <span className="status-pill active">
            <CheckCircle size={12} className="mr-1" /> Completed
          </span>
        )
      case 'rejected':
        return (
          <span className="status-pill blocked">
            <XCircle size={12} className="mr-1" /> Rejected
          </span>
        )
      default:
        return <span className="status-pill muted">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="page-loading-wrap">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="withdrawal-page fade-in">
      <div className="page-header-row">
        <h2>Withdrawal Payouts</h2>
        <p className="subtitle">Convert your coin balance into real-world cash assets</p>
      </div>

      <div className="withdrawal-grid">
        {/* Form and info */}
        <div className="withdrawal-inputs-col">
          {/* Balance card */}
          <div className="card glass-card balance-summary-card">
            <div className="summary-left">
              <span className="summary-label">Withdrawable Balance</span>
              <span className="summary-val gold-glow-text">
                {formatNumber(summary?.availableBalance)} Coins
              </span>
              <span className="usd-valuation">
                Valued at ≈ ${( (summary?.availableBalance || 0) * (summary?.conversionRate || 0.001) ).toFixed(2)} USD
              </span>
            </div>
            <div className="summary-right">
              <div className="details-badge">Min payout: {formatNumber(summary?.minimumCoins)} coins</div>
              <div className="details-badge">1,000 coins = $1.00 USD</div>
            </div>
          </div>

          {/* Form Card */}
          <div className="card glass-card form-card">
            <div className="card-header">
              <h3>Submit Payout Request</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} className="withdrawal-form">
                <div className="form-group">
                  <label htmlFor="amount">Withdrawal Amount (in Coins)</label>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Min: ${summary?.minimumCoins || 1000}`}
                    min={summary?.minimumCoins || 1000}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="method">Payout Method</label>
                  <select
                    id="method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="usdt">USDT (Crypto - TRC20)</option>
                    <option value="paypal">PayPal (USD Email)</option>
                    <option value="payoneer">Payoneer Email</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="details">Destination Payout Details</label>
                  <textarea
                    id="details"
                    rows="3"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={
                      method === 'usdt'
                        ? 'Enter TRC20 Wallet Address (e.g. TX...'
                        : 'Enter Payout Email Address (e.g. name@...'
                    }
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block submit-payout-btn"
                  disabled={actionLoading}
                >
                  {actionLoading ? <LoadingSpinner size="sm" /> : 'Confirm Payout Request'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="withdrawal-policy-col">
          <div className="card glass-card policy-card border-gold">
            <div className="card-header">
              <AlertTriangle className="text-gold" />
              <h3>Payout Policy Rules</h3>
            </div>
            <div className="card-body">
              <ul className="policy-list">
                <li>
                  All withdrawal transactions undergo anti-fraud manual audit checking. Please allow
                  up to <strong>3 business days</strong> for completion.
                </li>
                <li>
                  Your referee accounts are checked upon withdrawal submission. Any fraudulent
                  referral signups will result in rejection and forfeiture.
                </li>
                <li>
                  Pending requests can be cancelled freely to restore coins back into your spendable
                  wallet.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* History Ledger Table */}
      <div className="card glass-card history-table-card">
        <div className="card-header">
          <h3>Payout Request History</h3>
        </div>
        <div className="card-body">
          {historyLoading && (
            <div className="list-loading-overlay">
              <LoadingSpinner size="md" />
            </div>
          )}

          {history.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No Withdrawal Requests"
              description="Your withdrawal history list is currently empty. Submit a request above to initialize your payout list."
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Request ID</th>
                      <th>Coins Requested</th>
                      <th>Method</th>
                      <th>Account Destination</th>
                      <th>Date Submitted</th>
                      <th>Ticket Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((req) => (
                      <tr key={req._id}>
                        <td className="font-mono text-sm">{req._id.substring(0, 10)}...</td>
                        <td className="font-semibold">{formatNumber(req.coinsRequested)} coins</td>
                        <td className="text-capitalize">{req.paymentMethod}</td>
                        <td className="text-sm truncate max-w-xs">{req.paymentDetails}</td>
                        <td>{new Date(req.createdAt).toLocaleString()}</td>
                        <td>{getStatusBadge(req.status)}</td>
                        <td>
                          {req.status === 'pending' ? (
                            <button
                              onClick={() => handleCancelRequest(req._id)}
                              disabled={actionLoading}
                              className="btn btn-danger btn-sm"
                            >
                              Cancel
                            </button>
                          ) : (
                            <span className="muted-text">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="table-pagination-row">
                  <button
                    disabled={page === 1 || historyLoading}
                    onClick={() => loadMoreHistory(page - 1)}
                    className="btn btn-secondary btn-sm"
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages || historyLoading}
                    onClick={() => loadMoreHistory(page + 1)}
                    className="btn btn-secondary btn-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Withdrawal
