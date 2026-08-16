import React, { useState, useEffect } from 'react'
import { Calendar, Gift, Award, Coins, HelpCircle } from 'lucide-react'
import dailyRewardApi from '../api/dailyRewardApi.js'
import useAuthStore from '../store/authStore.js'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'

const DailyRewards = () => {
  const { user, updateUserWallet } = useAuthStore()
  const [rewardData, setRewardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claimLoading, setClaimLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await dailyRewardApi.getRewardStatus()
      setRewardData(response.data.data)
    } catch (err) {
      console.error('[DailyReward] Fetch error:', err)
      setError(err.response?.data?.message || 'Failed to retrieve daily check-in details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleClaim = async () => {
    setClaimLoading(true)
    try {
      const response = await dailyRewardApi.claimReward()
      const result = response.data.data

      toast.success(result.message || 'Claimed successfully!')
      setRewardData((prev) => ({
        ...prev,
        streakCount: result.streakCount,
        canClaim: false,
        lastClaimAt: new Date().toISOString(),
      }))

      // Sync the coins back to the user's wallet
      if (user && user.wallet) {
        updateUserWallet({
          ...user.wallet,
          availableBalance: result.newBalance,
        })
      }
    } catch (err) {
      console.error('[DailyReward] Claim error:', err)
      toast.error(err.response?.data?.message || 'Could not claim daily reward.')
    } finally {
      setClaimLoading(false)
    }
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
        <h3>Daily Rewards Unavailable</h3>
        <p>{error}</p>
        <button onClick={fetchStatus} className="btn btn-primary">Try Again</button>
      </div>
    )
  }

  const streak = rewardData?.streakCount || 0
  const canClaim = rewardData?.canClaim

  // Figure out which card is the active claim day
  const nextClaimDay = canClaim ? (streak % 7) + 1 : (streak % 7) === 0 ? 7 : (streak % 7)

  return (
    <div className="daily-reward-page fade-in">
      <div className="page-header-row">
        <h2>Daily Check-in</h2>
        <p className="subtitle">Log in consecutive days to earn larger coin multipliers!</p>
      </div>

      {/* Main Claim Banner */}
      <div className="card glass-card claim-banner-card border-gold">
        <div className="banner-left">
          <Gift className="gift-banner-icon animate-pulse" />
          <div className="banner-meta">
            <h3>{canClaim ? 'Today\'s Reward is Ready!' : 'Check in Again Tomorrow!'}</h3>
            <p>
              Current Streak: <strong>{streak} Days</strong> | Longest Streak:{' '}
              <strong>{rewardData?.longestStreak || 0} Days</strong>
            </p>
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={!canClaim || claimLoading}
          className="btn btn-primary claim-action-btn"
        >
          {claimLoading ? (
            <LoadingSpinner size="sm" />
          ) : canClaim ? (
            'Claim Daily Coins'
          ) : (
            'Claimed Today'
          )}
        </button>
      </div>

      {/* 7 Day Schedule Calendar Grid */}
      <div className="daily-schedule-title">
        <h3>7-Day Milestones Schedule</h3>
      </div>
      
      <div className="daily-calendar-grid">
        {rewardData?.schedule?.map((dayConfig) => {
          const isCompleted = dayConfig.day < nextClaimDay || (dayConfig.day === nextClaimDay && !canClaim)
          const isActive = dayConfig.day === nextClaimDay && canClaim
          
          let cardClass = 'daily-day-card glass-card'
          if (isCompleted) cardClass += ' completed'
          if (isActive) cardClass += ' active border-gold'
          if (dayConfig.isSpecial) cardClass += ' special-bonus'

          return (
            <div key={dayConfig.day} className={cardClass}>
              <span className="day-number">Day {dayConfig.day}</span>
              <div className="day-reward-display">
                <Coins className="reward-coin-symbol" />
                <span className="reward-coins-count">
                  +{formatNumber(dayConfig.rewardCoins * (dayConfig.bonusMultiplier || 1))}
                </span>
              </div>
              <span className="day-label">{dayConfig.label || `Day ${dayConfig.day}`}</span>
              
              {isCompleted && <span className="day-status-indicator">Claimed</span>}
              {isActive && <span className="day-status-indicator active">Claim Now</span>}
              {!isCompleted && !isActive && <span className="day-status-indicator locked">Locked</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DailyRewards
