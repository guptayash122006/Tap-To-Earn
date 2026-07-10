import express from 'express'
import authRoutes        from './authRoutes.js'
import tapRoutes         from './tapRoutes.js'
import referralRoutes    from './referralRoutes.js'
import withdrawalRoutes  from './withdrawalRoutes.js'
// Future route imports go here:
// import tapRoutes          from './tapRoutes.js'
// import leaderboardRoutes  from './leaderboardRoutes.js'
// import referralRoutes     from './referralRoutes.js'
// import dailyRewardRoutes  from './dailyRewardRoutes.js'
// import withdrawalRoutes   from './withdrawalRoutes.js'
// import transactionRoutes  from './transactionRoutes.js'
// import userRoutes         from './userRoutes.js'
// import adminRoutes        from './adminRoutes.js'

const router = express.Router()

// ── Health Check ──────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Tap-to-Earn API is running 🚀',
    timestamp: new Date().toISOString(),
    uptime: process.uptime().toFixed(2) + 's',
  })
})

// ── Mount Feature Routes ──────────────────────────────────
router.use('/auth',       authRoutes)
router.use('/tap',        tapRoutes)
router.use('/referral',   referralRoutes)
router.use('/withdrawal', withdrawalRoutes)
// router.use('/leaderboard',  leaderboardRoutes)
// router.use('/referral',     referralRoutes)
// router.use('/daily-reward', dailyRewardRoutes)
// router.use('/withdrawal',   withdrawalRoutes)
// router.use('/transactions', transactionRoutes)
// router.use('/user',         userRoutes)
// router.use('/admin',        adminRoutes)

export default router
