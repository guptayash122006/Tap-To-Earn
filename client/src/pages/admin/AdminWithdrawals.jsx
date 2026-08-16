import React, { useState, useEffect } from 'react'
import { Check, X, Clock, AlertCircle } from 'lucide-react'
import adminApi from '../../api/adminApi.js'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'

const AdminWithdrawals = () => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('pending')

  // Form actions
  const [activeReqId, setActiveReqId] = useState(null)
  const [actionType, setActionType] = useState('') // 'approve', 'reject', 'process'
  const [txnRef, setTxnRef] = useState('')
  const [note, setNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchWithdrawalsQueue = async (pageIndex, status) => {
    setLoading(true)
    try {
      const res = await adminApi.getWithdrawals({
        page: pageIndex,
        limit: 15,
        status: status || undefined,
      })
      setRequests(res.data.data.requests || [])
      setTotalPages(res.data.data.pagination?.totalPages || 1)
      setPage(pageIndex)
    } catch (err) {
      toast.error('Failed to load withdrawals queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWithdrawalsQueue(1, statusFilter)
  }, [statusFilter])

  const handleApprove = async (id) => {
    if (!txnRef.trim()) {
      toast.error('Transaction reference hash/number is required.')
      return
    }

    setActionLoading(true)
    try {
      const res = await adminApi.approveWithdrawal(id, txnRef.trim(), note.trim())
      toast.success(res.data.message || 'Withdrawal approved successfully!')
      setActiveReqId(null)
      setTxnRef('')
      setNote('')
      fetchWithdrawalsQueue(page, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (id) => {
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required.')
      return
    }

    setActionLoading(true)
    try {
      const res = await adminApi.rejectWithdrawal(id, rejectReason.trim())
      toast.success(res.data.message || 'Withdrawal rejected successfully!')
      setActiveReqId(null)
      setRejectReason('')
      fetchWithdrawalsQueue(page, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleProcess = async (id) => {
    setActionLoading(true)
    try {
      const res = await adminApi.processWithdrawal(id, note.trim() || 'Ticket set to processing')
      toast.success(res.data.message || 'Withdrawal set to processing state.')
      setActiveReqId(null)
      setNote('')
      fetchWithdrawalsQueue(page, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Processing update failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  return (
    <div className="admin-withdrawals-page fade-in">
      <div className="page-header-row">
        <h2>Payout Requests Queue</h2>
        <p className="subtitle">Audit and process user coin-to-cash payout withdrawal requests</p>
      </div>

      {/* Filters */}
      <div className="card glass-card filters-card mb-6">
        <div className="card-body flex justify-between items-center flex-wrap gap-4">
          <span className="info-text-label">Review Queue Filters</span>
          <div className="status-selector-flex">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="pending">Pending Audit Only</option>
              <option value="processing">In Processing Only</option>
              <option value="approved">Approved & Completed</option>
              <option value="rejected">Rejected Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="card glass-card queue-table-card">
        <div className="card-body relative min-h-[400px]">
          {loading && (
            <div className="list-loading-overlay">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!loading && requests.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Queue is Empty"
              description="No withdrawal requests correspond to the selected filter status."
            />
          ) : (
            !loading && (
              <>
                <div className="table-responsive">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Coins Requested</th>
                        <th>USDT Val</th>
                        <th>Method</th>
                        <th>Details/Account</th>
                        <th>Submitted Date</th>
                        <th>Status</th>
                        <th style={{ width: '220px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((item) => (
                        <React.Fragment key={item._id}>
                          <tr>
                            <td className="font-semibold">{item.userId?.username || 'Unknown'}</td>
                            <td className="font-semibold">{formatNumber(item.coinsRequested)}</td>
                            <td className="text-green">${item.fiatAmount?.toFixed(2)}</td>
                            <td className="text-capitalize">{item.paymentMethod}</td>
                            <td className="text-sm truncate max-w-xs">{item.paymentDetails}</td>
                            <td className="text-sm">{new Date(item.createdAt).toLocaleString()}</td>
                            <td>
                              <span className={`status-pill ${item.status}`}>
                                {item.status}
                              </span>
                            </td>
                            <td>
                              {item.status === 'pending' || item.status === 'processing' ? (
                                <div className="actions-flex gap-2">
                                  {item.status === 'pending' && (
                                    <button
                                      onClick={() => {
                                        setActiveReqId(item._id)
                                        setActionType('process')
                                      }}
                                      className="btn btn-secondary btn-sm flex items-center gap-1 text-cyan"
                                    >
                                      Process
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setActiveReqId(item._id)
                                      setActionType('approve')
                                    }}
                                    className="btn btn-secondary btn-sm flex items-center gap-1 text-green"
                                  >
                                    <Check size={12} /> Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveReqId(item._id)
                                      setActionType('reject')
                                    }}
                                    className="btn btn-secondary btn-sm flex items-center gap-1 text-red"
                                  >
                                    <X size={12} /> Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="muted-text">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Dropdowns */}
                          {activeReqId === item._id && (
                            <tr className="action-row-dropdown">
                              <td colSpan="8">
                                <div className="action-card-nested border-gold">
                                  {actionType === 'approve' && (
                                    <div className="form-panel-flex">
                                      <div className="meta">
                                        <h4>Approve Withdrawal</h4>
                                        <p>Input payment ledger tracking reference once paid</p>
                                      </div>
                                      <div className="inputs-row">
                                        <input
                                          type="text"
                                          placeholder="Transaction Ref (e.g. hash...)"
                                          value={txnRef}
                                          onChange={(e) => setTxnRef(e.target.value)}
                                        />
                                        <input
                                          type="text"
                                          placeholder="Optional Note..."
                                          value={note}
                                          onChange={(e) => setNote(e.target.value)}
                                        />
                                        <button
                                          onClick={() => handleApprove(item._id)}
                                          disabled={actionLoading}
                                          className="btn btn-success btn-sm"
                                        >
                                          Mark Paid
                                        </button>
                                        <button
                                          onClick={() => setActiveReqId(null)}
                                          className="btn btn-secondary btn-sm"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {actionType === 'reject' && (
                                    <div className="form-panel-flex">
                                      <div className="meta">
                                        <h4>Reject Withdrawal</h4>
                                        <p>Rejection will return coins back to user's wallet</p>
                                      </div>
                                      <div className="inputs-row">
                                        <input
                                          type="text"
                                          placeholder="Reason for rejection..."
                                          value={rejectReason}
                                          onChange={(e) => setRejectReason(e.target.value)}
                                        />
                                        <button
                                          onClick={() => handleReject(item._id)}
                                          disabled={actionLoading}
                                          className="btn btn-danger btn-sm"
                                        >
                                          Confirm Reject
                                        </button>
                                        <button
                                          onClick={() => setActiveReqId(null)}
                                          className="btn btn-secondary btn-sm"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {actionType === 'process' && (
                                    <div className="form-panel-flex">
                                      <div className="meta">
                                        <h4>Set Request to Processing</h4>
                                        <p>Signals that payment is in progress</p>
                                      </div>
                                      <div className="inputs-row">
                                        <input
                                          type="text"
                                          placeholder="Optional note (e.g. Processing payouts...)"
                                          value={note}
                                          onChange={(e) => setNote(e.target.value)}
                                        />
                                        <button
                                          onClick={() => handleProcess(item._id)}
                                          disabled={actionLoading}
                                          className="btn btn-primary btn-sm"
                                        >
                                          Set Processing
                                        </button>
                                        <button
                                          onClick={() => setActiveReqId(null)}
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
                      onClick={() => fetchWithdrawalsQueue(page - 1, statusFilter)}
                      className="btn btn-secondary btn-sm"
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages || loading}
                      onClick={() => fetchWithdrawalsQueue(page + 1, statusFilter)}
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

export default AdminWithdrawals
