import asyncHandler from '../utils/asyncHandler.js'
import ApiResponse from '../utils/apiResponse.js'
import { getDailyRewardStatus, claimDailyReward } from '../services/rewardService.js'

// ─────────────────────────────────────────────────────────────
// GET /api/daily-reward/status
// ─────────────────────────────────────────────────────────────
export const getRewardStatus = asyncHandler(async (req, res) => {
  const status = await getDailyRewardStatus(req.user._id)
  return ApiResponse.success(res, 200, 'Daily reward status retrieved.', status)
})

// ─────────────────────────────────────────────────────────────
// POST /api/daily-reward/claim
// ─────────────────────────────────────────────────────────────
export const claimReward = asyncHandler(async (req, res) => {
  try {
    const result = await claimDailyReward(req.user._id)
    return ApiResponse.success(res, 200, result.message, result)
  } catch (err) {
    if (err.code === 'ALREADY_CLAIMED') {
      return ApiResponse.error(res, 400, err.message)
    }
    throw err
  }
})
