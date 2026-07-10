import asyncHandler from '../utils/asyncHandler.js'
import ApiResponse   from '../utils/apiResponse.js'
import { validateAndProcessTap, getUserTapStatus } from '../services/tapService.js'

// ─────────────────────────────────────────────────────────────
// POST /api/tap
// ─────────────────────────────────────────────────────────────
export const registerTap = asyncHandler(async (req, res) => {
  const userId = req.user._id

  const {
    tapCount,
    sessionId,
    clientTimestamp,
    tapIntervals,
    energyAtClient,
  } = req.body

  const ipAddress = req.ip || req.headers['x-forwarded-for'] || null
  const userAgent = req.headers['user-agent'] || null

  const result = await validateAndProcessTap(userId, {
    tapCount:        parseInt(tapCount, 10),
    sessionId,
    clientTimestamp,
    tapIntervals:    tapIntervals || [],
    energyAtClient,
    ipAddress,
    userAgent,
  })

  // Warn in response header if flagged (client can show cheat warning)
  if (result.isSuspicious) {
    res.setHeader('X-Tap-Suspicious', '1')
    res.setHeader('X-Tap-Score',      String(result.suspicionScore))
  }

  return ApiResponse.success(res, 200, 'Taps registered successfully.', result)
})

// ─────────────────────────────────────────────────────────────
// GET /api/tap/status
// ─────────────────────────────────────────────────────────────
export const getTapStatus = asyncHandler(async (req, res) => {
  const status = await getUserTapStatus(req.user._id)
  return ApiResponse.success(res, 200, 'Tap status retrieved.', status)
})

// ─────────────────────────────────────────────────────────────
// Error code → HTTP status mapping (used by error handler)
// ─────────────────────────────────────────────────────────────
export const TAP_ERROR_CODES = {
  ENERGY_EMPTY:          400,
  LIMIT_REACHED:         403,
  AUTO_CLICK_DETECTED:   429,
  USER_NOT_FOUND:        404,
  ACCOUNT_INACTIVE:      403,
}
