import express    from 'express'
import rateLimit  from 'express-rate-limit'
import protect    from '../middleware/authMiddleware.js'
import asyncHandler from '../utils/asyncHandler.js'
import ApiResponse  from '../utils/apiResponse.js'
import { validateAndGrantAdReward, getAdStatus } from '../services/adRewardService.js'

const router = express.Router()

// ── Rate limiter: 10 ad reward attempts per hour per IP ────────
const adLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             10,
  message:         { success: false, message: 'Too many ad reward requests from this IP.' },
  standardHeaders: true,
  legacyHeaders:   false,
})

/**
 * @route  POST /api/ads/reward
 * @desc   Validate completed rewarded ad view and grant energy (NOT coins).
 * @access Private (must be logged in)
 *
 * POLICY NOTE: This endpoint ONLY grants energy (non-withdrawable in-game resource).
 * Any attempt to request 'coins' or 'balance' as rewardType will be rejected
 * with a POLICY_VIOLATION error.
 */
router.post(
  '/reward',
  protect,
  adLimiter,
  asyncHandler(async (req, res) => {
    const {
      rewardType,
      energyAmount,
      sessionToken,
      timestamp,
      placementName,
    } = req.body

    // Basic presence check before service call
    if (!rewardType || !sessionToken || !timestamp) {
      return ApiResponse.error(res, 400, 'rewardType, sessionToken, and timestamp are required.')
    }

    const result = await validateAndGrantAdReward(req.user._id, {
      rewardType,
      energyAmount,
      sessionToken,
      timestamp,
      placementName,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    })

    return ApiResponse.success(res, 200, result.message, result)
  })
)

/**
 * @route  GET /api/ads/status
 * @desc   Get current ad watch status for a user (cooldown, hourly count, energy)
 * @access Private
 */
router.get(
  '/status',
  protect,
  asyncHandler(async (req, res) => {
    const status = await getAdStatus(req.user._id)
    return ApiResponse.success(res, 200, 'Ad status retrieved.', status)
  })
)

export default router
