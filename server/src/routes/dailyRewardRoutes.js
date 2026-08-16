import express from 'express'
import protect from '../middleware/authMiddleware.js'
import { getRewardStatus, claimReward } from '../controllers/dailyRewardController.js'

const router = express.Router()

/**
 * @route  GET /api/daily-reward/status
 * @desc   Get current daily streak, claim status, and rewards calendar
 * @access Private
 */
router.get('/status', protect, getRewardStatus)

/**
 * @route  POST /api/daily-reward/claim
 * @desc   Claim daily reward (credits coins, updates user streak)
 * @access Private
 */
router.post('/claim', protect, claimReward)

export default router
