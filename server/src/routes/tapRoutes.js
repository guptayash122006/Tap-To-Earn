import express          from 'express'
import protect           from '../middleware/authMiddleware.js'
import { tapLimiter }   from '../middleware/rateLimiter.js'
import validate          from '../middleware/validate.js'
import tapValidator      from '../validators/tapValidator.js'
import { registerTap, getTapStatus } from '../controllers/tapController.js'

const router = express.Router()

/**
 * @route  POST /api/tap
 * @desc   Register a tap batch (1–10 taps). Deducts energy, credits coins,
 *         runs anti-cheat analysis, saves TapSession audit record.
 * @access Private
 */
router.post(
  '/',
  protect,
  tapLimiter,                         // max 10 taps/sec per user
  tapValidator.registerTap,
  validate,
  registerTap,
)

/**
 * @route  GET /api/tap/status
 * @desc   Get current energy, tap counts, and lifetime progress.
 * @access Private
 */
router.get('/status', protect, getTapStatus)

export default router
