import asyncHandler   from '../utils/asyncHandler.js'
import ApiResponse    from '../utils/apiResponse.js'
import {
  getUserReferralInfo,
  validateReferralCode,
  getMyReferrals,
  getReferralStats,
  getTopReferrers,
} from '../services/referralService.js'

// ─────────────────────────────────────────────────────────────
// GET /api/referral/code
// ─────────────────────────────────────────────────────────────
/**
 * Returns the authenticated user's referral code, link, and summary stats.
 */
export const getMyCode = asyncHandler(async (req, res) => {
  const info = await getUserReferralInfo(req.user._id)
  return ApiResponse.success(res, 200, 'Referral info retrieved.', info)
})

// ─────────────────────────────────────────────────────────────
// GET /api/referral/stats
// ─────────────────────────────────────────────────────────────
/**
 * Full referral dashboard stats including recent referrals list.
 */
export const getStats = asyncHandler(async (req, res) => {
  const stats = await getReferralStats(req.user._id)
  return ApiResponse.success(res, 200, 'Referral stats retrieved.', stats)
})

// ─────────────────────────────────────────────────────────────
// GET /api/referral/list
// ─────────────────────────────────────────────────────────────
/**
 * Paginated list of all users this person has referred.
 */
export const getList = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)))

  const result = await getMyReferrals(req.user._id, { page, limit })
  return ApiResponse.success(res, 200, 'Referral list retrieved.', result)
})

// ─────────────────────────────────────────────────────────────
// POST /api/referral/validate
// ─────────────────────────────────────────────────────────────
/**
 * Public endpoint — validates a referral code before the user registers.
 * No auth required.
 */
export const validateCode = asyncHandler(async (req, res) => {
  const { code } = req.body

  if (!code || typeof code !== 'string') {
    return ApiResponse.error(res, 400, 'Referral code is required.')
  }

  const result = await validateReferralCode(code.trim().toUpperCase())

  if (!result.valid) {
    return ApiResponse.error(res, 404, result.message)
  }

  return ApiResponse.success(res, 200, result.message, {
    referrerName:  result.referrerName,
    refereeBonus:  result.refereeBonus,
  })
})

// ─────────────────────────────────────────────────────────────
// GET /api/referral/leaderboard
// ─────────────────────────────────────────────────────────────
/**
 * Top 10 referrers by count — public endpoint.
 */
export const getReferralLeaderboard = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)))
  const top   = await getTopReferrers(limit)
  return ApiResponse.success(res, 200, 'Referral leaderboard retrieved.', { leaderboard: top })
})
