import React, { useState, useEffect } from 'react'
import { Trophy, Award, Medal, Coins, ArrowUp, User } from 'lucide-react'
import useLeaderboardStore from '../store/leaderboardStore.js'
import useAuthStore from '../store/authStore.js'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import EmptyState from '../components/common/EmptyState.jsx'

const Leaderboard = () => {
  const { user } = useAuthStore()
  const { leaderboard, userRank, loading, error, fetchLeaderboard } = useLeaderboardStore()
  const [period, setPeriod] = useState('allTime') // allTime, daily, weekly, monthly

  useEffect(() => {
    fetchLeaderboard(period)
  }, [period])

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Medal className="text-gold animate-bounce" size={24} />
      case 2:
        return <Medal className="text-silver" size={24} />
      case 3:
        return <Medal className="text-bronze" size={24} />
      default:
        return <span className="rank-number-text">{rank}</span>
    }
  }

  const getPeriodLabel = (p) => {
    switch (p) {
      case 'allTime':
        return 'Total Coins'
      case 'daily':
        return 'Today\'s Coins'
      case 'weekly':
        return 'This Week\'s Coins'
      case 'monthly':
        return 'This Month\'s Coins'
      default:
        return 'Coins'
    }
  }

  const getCoinsForPeriod = (item, p) => {
    switch (p) {
      case 'allTime':
        return item.totalCoins
      case 'daily':
        return item.coinsToday
      case 'weekly':
        return item.coinsThisWeek
      case 'monthly':
        return item.coinsThisMonth
      default:
        return item.totalCoins
    }
  }

  const getUserRankForPeriod = (rankObj, p) => {
    if (!rankObj) return '—'
    switch (p) {
      case 'allTime':
        return rankObj.rankAllTime
      case 'daily':
        return rankObj.rankDaily
      case 'weekly':
        return rankObj.rankWeekly
      case 'monthly':
        return rankObj.rankMonthly
      default:
        return rankObj.rankAllTime
    }
  }

  return (
    <div className="leaderboard-page fade-in">
      <div className="page-header-row">
        <h2>Clash Standings</h2>
        <p className="subtitle">Climb the leaderboard charts to showcase your tapping dominance</p>
      </div>

      {/* Tabs */}
      <div className="leaderboard-tabs-wrapper">
        <button
          onClick={() => setPeriod('allTime')}
          className={`tab-btn ${period === 'allTime' ? 'active' : ''}`}
        >
          All-Time
        </button>
        <button
          onClick={() => setPeriod('daily')}
          className={`tab-btn ${period === 'daily' ? 'active' : ''}`}
        >
          Daily
        </button>
        <button
          onClick={() => setPeriod('weekly')}
          className={`tab-btn ${period === 'weekly' ? 'active' : ''}`}
        >
          Weekly
        </button>
        <button
          onClick={() => setPeriod('monthly')}
          className={`tab-btn ${period === 'monthly' ? 'active' : ''}`}
        >
          Monthly
        </button>
      </div>

      {/* Active User Rank Row Banner */}
      {userRank && (
        <div className="card glass-card user-rank-highlight-card border-gold">
          <div className="card-left">
            <Trophy className="banner-trophy-icon animate-pulse" />
            <div className="meta">
              <h3>Your Standing</h3>
              <p>
                Rival Rank: <strong>#{getUserRankForPeriod(userRank, period) || 'Not Placed'}</strong> |{' '}
                Score: <strong>{formatNumber(getCoinsForPeriod(userRank, period))} coins</strong>
              </p>
            </div>
          </div>
          <div className="card-right">
            <span className="standing-badge">Top Placement</span>
          </div>
        </div>
      )}

      {/* Standings Table Card */}
      <div className="card glass-card table-card mt-6">
        <div className="card-header">
          <h3>Top Competitor Ranks</h3>
        </div>

        <div className="card-body relative">
          {loading && (
            <div className="list-loading-overlay">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {error && (
            <div className="error-wrap text-center py-10">
              <p className="text-red font-semibold mb-4">{error}</p>
              <button onClick={() => fetchLeaderboard(period)} className="btn btn-primary">
                Try Refreshing
              </button>
            </div>
          )}

          {!loading && !error && leaderboard.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Empty Rankings Table"
              description="No leaderboard entries are currently populated. Tap the coin on the Dashboard to populate rankings!"
            />
          ) : (
            !loading && !error && (
              <div className="table-responsive">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Rank</th>
                      <th>Username</th>
                      <th style={{ width: '120px' }}>Level</th>
                      <th className="text-right">{getPeriodLabel(period)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((item, idx) => {
                      const displayRank = idx + 1
                      const isSelf = String(item.userId?._id || item.userId) === String(user?._id)
                      const coinsCount = getCoinsForPeriod(item, period)

                      return (
                        <tr key={item._id} className={isSelf ? 'table-highlight-row' : ''}>
                          <td>
                            <div className="rank-indicator-wrap">{getRankIcon(displayRank)}</div>
                          </td>
                          <td className="font-semibold flex items-center gap-2">
                            <span className="username-cell">{item.username}</span>
                            {isSelf && <span className="self-tag">You</span>}
                          </td>
                          <td>Level {item.level || 1}</td>
                          <td className="text-right font-semibold gold">
                            <div className="coin-value-td">
                              <Coins size={14} className="inline mr-1" />
                              {formatNumber(coinsCount)}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default Leaderboard
