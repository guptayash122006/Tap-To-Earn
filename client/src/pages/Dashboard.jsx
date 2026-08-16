import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, Share2, Trophy, Wallet, Zap, Coins, UserCheck } from 'lucide-react'
import useAuthStore from '../store/authStore.js'
import useTapStore from '../store/tapStore.js'
import ROUTES from '../router/routes.js'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { user } = useAuthStore()
  const {
    coins,
    energy,
    maxEnergy,
    tapPower,
    todayTaps,
    lifetimeRemaining,
    tap,
    fetchStatus,
    setInitialState,
  } = useTapStore()

  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (user) {
      setInitialState(user)
    }
    fetchStatus()
  }, [user])

  // Energy percentage helper
  const energyPercentage = Math.min(100, Math.max(0, (energy / maxEnergy) * 100))

  const handleCoinTap = (e) => {
    // Prevent default zoom on mobile double taps
    e.preventDefault()

    const success = tap()
    if (!success) {
      toast.error('Energy depleted! Wait for refill.')
      return
    }

    // Capture touch or click coordinates relative to the coin card
    const rect = e.currentTarget.getBoundingClientRect()
    let x, y

    if (e.touches && e.touches[0]) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    const newParticle = {
      id: Date.now() + Math.random(),
      x,
      y,
      text: `+${tapPower}`,
    }

    setParticles((prev) => [...prev, newParticle])
  }

  const removeParticle = (id) => {
    setParticles((prev) => prev.filter((p) => p.id !== id))
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  return (
    <div className="dashboard-container fade-in">
      {/* Top Cards Grid */}
      <div className="stats-cards-grid">
        <div className="card glass-card stat-card border-gold">
          <div className="stat-icon-wrap gold">
            <Coins />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Coins</span>
            <span className="stat-value gold-glow-text">{formatNumber(coins)}</span>
          </div>
        </div>

        <div className="card glass-card stat-card border-purple">
          <div className="stat-icon-wrap purple">
            <Zap />
          </div>
          <div className="stat-content">
            <span className="stat-label">Taps Today</span>
            <span className="stat-value">{formatNumber(todayTaps)}</span>
          </div>
        </div>

        <div className="card glass-card stat-card border-cyan">
          <div className="stat-icon-wrap cyan">
            <UserCheck />
          </div>
          <div className="stat-content">
            <span className="stat-label">Status</span>
            <span className="stat-value text-capitalize">{user?.status || 'Active'}</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Tap Area */}
      <div className="main-interactive-grid">
        <div className="card glass-card tap-area-card">
          <div className="card-header">
            <h3>Tap to Earn</h3>
            <span className="lifetime-remaining">
              Lifetime Left: {formatNumber(lifetimeRemaining)}
            </span>
          </div>

          <div className="coin-interactive-wrapper">
            <motion.div
              className={`coin-circle-outer ${energy <= 0 ? 'disabled' : ''}`}
              whileHover={energy > 0 ? { scale: 1.02 } : {}}
              whileTap={energy > 0 ? { scale: 0.95 } : {}}
              onTouchStart={energy > 0 ? handleCoinTap : undefined}
              onMouseDown={energy > 0 ? handleCoinTap : undefined}
            >
              <div className="coin-circle-inner">
                <Coins className="coin-icon-svg" />
              </div>

              {/* Float-up Numbers Particle Overlay */}
              <AnimatePresence>
                {particles.map((p) => (
                  <motion.span
                    key={p.id}
                    className="floating-tap-number"
                    style={{ left: p.x, top: p.y }}
                    initial={{ opacity: 1, y: 0, scale: 1 }}
                    animate={{ opacity: 0, y: -120, scale: 1.4 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    onAnimationComplete={() => removeParticle(p.id)}
                  >
                    {p.text}
                  </motion.span>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Energy indicators */}
          <div className="energy-system-wrapper">
            <div className="energy-bar-labels">
              <span className="energy-label">
                <Zap className="label-icon animate-pulse" />
                Energy Limit
              </span>
              <span className="energy-numeric">
                {energy} / {maxEnergy}
              </span>
            </div>
            <div className="energy-progress-track">
              <div
                className="energy-progress-fill"
                style={{ width: `${energyPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Quick actions panel */}
        <div className="card glass-card quick-actions-card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions-list">
            <Link to={ROUTES.DAILY_REWARD} className="quick-action-link gold-hover">
              <div className="action-icon bg-gold-low">
                <Gift className="text-gold" />
              </div>
              <div className="action-meta">
                <span className="action-title">Streak Check-in</span>
                <span className="action-desc">Claim daily coin rewards</span>
              </div>
            </Link>

            <Link to={ROUTES.REFERRAL} className="quick-action-link purple-hover">
              <div className="action-icon bg-purple-low">
                <Share2 className="text-purple" />
              </div>
              <div className="action-meta">
                <span className="action-title">Invite Friends</span>
                <span className="action-desc">Get {user?.referralCode ? '20' : '50'} coins bonus per invite</span>
              </div>
            </Link>

            <Link to={ROUTES.LEADERBOARD} className="quick-action-link cyan-hover">
              <div className="action-icon bg-cyan-low">
                <Trophy className="text-cyan" />
              </div>
              <div className="action-meta">
                <span className="action-title">Top Standings</span>
                <span className="action-desc">Compare scores against other players</span>
              </div>
            </Link>

            <Link to={ROUTES.WITHDRAW} className="quick-action-link green-hover">
              <div className="action-icon bg-green-low">
                <Wallet className="text-green" />
              </div>
              <div className="action-meta">
                <span className="action-title">Cash Payout</span>
                <span className="action-desc">Convert coins into USD balance</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
