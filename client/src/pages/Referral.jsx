import React, { useState, useEffect } from 'react'
import { Copy, Users, CheckCircle, Clock, Coins, Share2 } from 'lucide-react'
import referralApi from '../api/referralApi.js'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import EmptyState from '../components/common/EmptyState.jsx'

const Referral = () => {
  const [stats, setStats] = useState(null)
  const [listData, setListData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const statsRes = await referralApi.getStats()
      setStats(statsRes.data.data)

      const listRes = await referralApi.getList(1, 10)
      setListData(listRes.data.data)
    } catch (err) {
      console.error('[Referral] Fetch data error:', err)
      setError(err.response?.data?.message || 'Failed to load referral details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const loadMoreReferrals = async (nextPage) => {
    setListLoading(true)
    try {
      const res = await referralApi.getList(nextPage, 10)
      setListData(res.data.data)
      setPage(nextPage)
    } catch (err) {
      toast.error('Failed to load next page.')
    } finally {
      setListLoading(false)
    }
  }

  const handleCopyLink = () => {
    if (!stats?.referralLink) return
    navigator.clipboard.writeText(stats.referralLink)
    toast.success('Referral link copied to clipboard!')
  }

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
        <h3>Error Loading Referrals</h3>
        <p>{error}</p>
        <button onClick={fetchData} className="btn btn-primary">Try Again</button>
      </div>
    )
  }

  return (
    <div className="referral-page-container fade-in">
      <div className="page-header-row">
        <h2>Invite & Earn</h2>
        <p className="subtitle">Invite your friends and earn bonuses once they become active players</p>
      </div>

      {/* Code Sharing Area */}
      <div className="card glass-card share-code-card border-gold">
        <div className="share-wrapper">
          <div className="share-left">
            <span className="share-label">Your Referral Link</span>
            <div className="share-link-box">
              <input
                type="text"
                readOnly
                value={stats?.referralLink || ''}
                onClick={handleCopyLink}
              />
              <button onClick={handleCopyLink} className="copy-btn">
                <Copy size={16} />
                <span>Copy</span>
              </button>
            </div>
            <p className="share-policy-hint">
              Referee must perform at least <strong>{stats?.activityThreshold || 100} taps</strong> to activate. 
              Referrer gets <strong>{stats?.referrerBonus || 50} coins</strong> per activation. Referee gets <strong>{stats?.refereeBonus || 20} coins</strong> on join.
            </p>
          </div>

          <div className="share-right">
            <span className="share-label">Your Referral Code</span>
            <span className="large-code-badge">{stats?.referralCode}</span>
          </div>
        </div>
      </div>

      {/* Invite Stats */}
      <div className="referral-stats-grid">
        <div className="card glass-card stat-item-card">
          <div className="icon-wrap bg-purple-low text-purple">
            <Users size={20} />
          </div>
          <div className="meta">
            <span className="label">Total Invited</span>
            <span className="val">{formatNumber(stats?.totalReferrals)}</span>
          </div>
        </div>

        <div className="card glass-card stat-item-card">
          <div className="icon-wrap bg-green-low text-green">
            <CheckCircle size={20} />
          </div>
          <div className="meta">
            <span className="label">Activated Invites</span>
            <span className="val">{formatNumber(stats?.activated)}</span>
          </div>
        </div>

        <div className="card glass-card stat-item-card">
          <div className="icon-wrap bg-gold-low text-gold">
            <Clock size={20} />
          </div>
          <div className="meta">
            <span className="label">Pending Activation</span>
            <span className="val">{formatNumber(stats?.pending)}</span>
          </div>
        </div>

        <div className="card glass-card stat-item-card">
          <div className="icon-wrap bg-cyan-low text-cyan">
            <Coins size={20} />
          </div>
          <div className="meta">
            <span className="label">Earnings Recieved</span>
            <span className="val gold-glow-text">{formatNumber(stats?.coinsEarned)} Coins</span>
          </div>
        </div>
      </div>

      {/* Invited List */}
      <div className="card glass-card referee-list-card">
        <div className="card-header">
          <h3>Invited Friends List</h3>
        </div>

        <div className="card-body">
          {listLoading && (
            <div className="list-loading-overlay">
              <LoadingSpinner size="md" />
            </div>
          )}

          {!listData?.referrals || listData.referrals.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="No Referrals Yet"
              description="Share your referral link with friends. Once they join and start tapping, they will appear here!"
              action={
                <button onClick={handleCopyLink} className="btn btn-primary">
                  Copy My Invite Link
                </button>
              }
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Friend Username</th>
                      <th>Joined Date</th>
                      <th>Taps Completed</th>
                      <th>Progress to Unlock</th>
                      <th>Status</th>
                      <th>Earnings Granted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listData.referrals.map((ref) => (
                      <tr key={ref.id}>
                        <td className="font-semibold">{ref.username}</td>
                        <td>{new Date(ref.joinedAt).toLocaleDateString()}</td>
                        <td>{formatNumber(ref.totalTaps)} taps</td>
                        <td>
                          <div className="table-progress-wrap">
                            <div className="progress-track-sm">
                              <div
                                className="progress-fill-sm"
                                style={{ width: `${ref.progressPct}%` }}
                              ></div>
                            </div>
                            <span className="progress-text">{ref.progressPct}%</span>
                          </div>
                        </td>
                        <td>
                          {ref.isActivated ? (
                            <span className="status-pill active">Unlocked</span>
                          ) : (
                            <span className="status-pill pending">Pending</span>
                          )}
                        </td>
                        <td className="gold font-semibold">
                          {ref.isActivated ? `+${ref.referrerBonus}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {listData.pagination?.totalPages > 1 && (
                <div className="table-pagination-row">
                  <button
                    disabled={page === 1 || listLoading}
                    onClick={() => loadMoreReferrals(page - 1)}
                    className="btn btn-secondary btn-sm"
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {page} of {listData.pagination.totalPages}
                  </span>
                  <button
                    disabled={page === listData.pagination.totalPages || listLoading}
                    onClick={() => loadMoreReferrals(page + 1)}
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

export default Referral
