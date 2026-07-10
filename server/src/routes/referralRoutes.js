import express from 'express'
import rateLimit from 'express-rate-limit'
import protect   from '../middleware/authMiddleware.js'
import validate  from '../middleware/validate.js'
import { body }  from 'express-validator'
import {
  getMyCode,
  getStats,
  getList,
  validateCode,
  getReferralLeaderboard,
} from '../controllers/referralController.js'

const router = express.Router()

// ── Dedicated rate limiter for referral validation ────────────
const validateLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,  // 1 hour
  max:              30,               // 30 checks per hour per IP
  message:          { success: false, message: 'Too many validation attempts. Try again later.' },
  standardHeaders:  true,
  legacyHeaders:    false,
})

// ──────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth required)
// ──────────────────────────────────────────────────────────────

/**
 * @route  POST /api/referral/validate
 * @desc   Validate a referral code before registration
 * @access Public
 */
router.post(
  '/validate',
  validateLimiter,
  body('code')
    .trim()
    .notEmpty().withMessage('Referral code is required.')
    .isAlphanumeric().withMessage('Code must be alphanumeric.')
    .isLength({ min: 6, max: 12 }).withMessage('Invalid code length.'),
  validate,
  validateCode,
)

/**
 * @route  GET /api/referral/leaderboard
 * @desc   Top referrers leaderboard (public)
 * @access Public
 */
router.get('/leaderboard', getReferralLeaderboard)

// ──────────────────────────────────────────────────────────────
// PROTECTED ROUTES (JWT required)
// ──────────────────────────────────────────────────────────────

/**
 * @route  GET /api/referral/code
 * @desc   Get my referral code + link + stats summary
 * @access Private
 */
router.get('/code', protect, getMyCode)

/**
 * @route  GET /api/referral/stats
 * @desc   Get full referral dashboard (stats + recent list)
 * @access Private
 */
router.get('/stats', protect, getStats)

/**
 * @route  GET /api/referral/list
 * @desc   Paginated list of referred users with activation status
 * @access Private
 */
router.get('/list', protect, getList)

export default router
