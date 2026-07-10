import express from 'express'
import { authValidator }  from '../validators/authValidator.js'
import validate           from '../middleware/validate.js'
import protect            from '../middleware/authMiddleware.js'
import { authLimiter }    from '../middleware/rateLimiter.js'
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  changePassword,
} from '../controllers/authController.js'

const router = express.Router()

// ── Public Routes ─────────────────────────────────────────
/**
 * @route  POST /api/auth/register
 * @desc   Create new user account (with optional referral code)
 * @access Public
 */
router.post(
  '/register',
  authLimiter,
  authValidator.register,
  validate,
  register,
)

/**
 * @route  POST /api/auth/login
 * @desc   Authenticate user, return access token + set refresh cookie
 * @access Public
 */
router.post(
  '/login',
  authLimiter,
  authValidator.login,
  validate,
  login,
)

/**
 * @route  POST /api/auth/refresh
 * @desc   Rotate refresh token, return new access token
 * @access Public (requires valid HttpOnly refresh cookie)
 */
router.post('/refresh', refresh)

// ── Protected Routes ──────────────────────────────────────
/**
 * @route  POST /api/auth/logout
 * @desc   Revoke refresh token, clear cookie
 * @access Private
 */
router.post('/logout', protect, logout)

/**
 * @route  GET /api/auth/me
 * @desc   Get current authenticated user profile + wallet
 * @access Private
 */
router.get('/me', protect, getMe)

/**
 * @route  PUT /api/auth/change-password
 * @desc   Change password (invalidates all sessions)
 * @access Private
 */
router.put(
  '/change-password',
  protect,
  authValidator.changePassword,
  validate,
  changePassword,
)

export default router
