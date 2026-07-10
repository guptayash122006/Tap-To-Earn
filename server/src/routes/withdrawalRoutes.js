import express         from 'express'
import rateLimit       from 'express-rate-limit'
import protect         from '../middleware/authMiddleware.js'
import adminOnly       from '../middleware/adminMiddleware.js'
import validate        from '../middleware/validate.js'
import {
  submitWithdrawalValidator,
  cancelWithdrawalValidator,
  adminApproveValidator,
  adminRejectValidator,
} from '../validators/withdrawalValidator.js'
import {
  createWithdrawal,
  cancelUserWithdrawal,
  getHistory,
  getSummary,
  adminQueue,
  adminApprove,
  adminReject,
  adminProcess,
} from '../controllers/withdrawalController.js'

const router = express.Router()

// ── Rate limiter: max 3 withdrawal submissions per hour ───────
const submitLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             3,
  message:         { success: false, message: 'Too many withdrawal requests. Limit: 3 per hour.' },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.user?._id?.toString() || req.ip,
})

// ─────────────────────────────────────────────────────────────
// USER ROUTES (protected)
// ─────────────────────────────────────────────────────────────

/**
 * @route  GET /api/withdrawal/summary
 * @desc   Get wallet balance + minimum/rate for withdrawal page
 * @access Private
 */
router.get('/summary', protect, getSummary)

/**
 * @route  GET /api/withdrawal/history
 * @desc   Paginated withdrawal history (filter by ?status=pending|approved|rejected)
 * @access Private
 */
router.get('/history', protect, getHistory)

/**
 * @route  POST /api/withdrawal
 * @desc   Submit a new withdrawal request
 * @access Private
 */
router.post(
  '/',
  protect,
  submitLimiter,
  submitWithdrawalValidator,
  validate,
  createWithdrawal,
)

/**
 * @route  DELETE /api/withdrawal/:id/cancel
 * @desc   Cancel a pending withdrawal request (restores coins)
 * @access Private
 */
router.delete(
  '/:id/cancel',
  protect,
  cancelWithdrawalValidator,
  validate,
  cancelUserWithdrawal,
)

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTES (admin role required)
// ─────────────────────────────────────────────────────────────

/**
 * @route  GET /api/withdrawal/admin/queue
 * @desc   List all withdrawals (filter: ?status=pending&page=1)
 * @access Admin
 */
router.get('/admin/queue', protect, adminOnly, adminQueue)

/**
 * @route  PATCH /api/withdrawal/admin/:id/approve
 * @desc   Approve a withdrawal — release pending coins, mark paid
 * @access Admin
 */
router.patch(
  '/admin/:id/approve',
  protect,
  adminOnly,
  adminApproveValidator,
  validate,
  adminApprove,
)

/**
 * @route  PATCH /api/withdrawal/admin/:id/reject
 * @desc   Reject a withdrawal — restore coins to user
 * @access Admin
 */
router.patch(
  '/admin/:id/reject',
  protect,
  adminOnly,
  adminRejectValidator,
  validate,
  adminReject,
)

/**
 * @route  PATCH /api/withdrawal/admin/:id/processing
 * @desc   Mark a withdrawal as processing (in-flight)
 * @access Admin
 */
router.patch('/admin/:id/processing', protect, adminOnly, adminProcess)

export default router
