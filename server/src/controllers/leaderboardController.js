import asyncHandler from '../utils/asyncHandler.js'
import ApiResponse from '../utils/apiResponse.js'
import { getLeaderboard } from '../services/leaderboardService.js'

// ─────────────────────────────────────────────────────────────
// GET /api/leaderboard
// ─────────────────────────────────────────────────────────────
export const getLeaderboardCtrl = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const period = req.query.period || 'allTime'
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10)))

  // Valid periods safety check
  const validPeriods = ['allTime', 'daily', 'weekly', 'monthly']
  if (!validPeriods.includes(period)) {
    return ApiResponse.error(res, 400, `Invalid period. Must be one of: ${validPeriods.join(', ')}`)
  }

  const data = await getLeaderboard(userId, period, limit)
  return ApiResponse.success(res, 200, 'Leaderboard retrieved successfully.', data)
})
