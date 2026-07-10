import ApiResponse from '../utils/apiResponse.js'
import { ROLES } from '../config/constants.js'

/**
 * requireAdmin — role-based access control middleware.
 *
 * MUST be used AFTER the `protect` middleware (relies on req.user).
 *
 * Usage (in routes):
 *   router.get('/admin/users', protect, requireAdmin, adminController.listUsers)
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return ApiResponse.error(res, 401, 'Authentication required.')
  }

  if (req.user.role !== ROLES.ADMIN) {
    return ApiResponse.error(
      res,
      403,
      'Access denied. Admin privileges required.',
    )
  }

  next()
}

/**
 * requireRole — generalized role guard.
 *
 * Usage:
 *   router.get('/route', protect, requireRole('admin', 'moderator'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return ApiResponse.error(res, 401, 'Authentication required.')
  }

  if (!roles.includes(req.user.role)) {
    return ApiResponse.error(
      res,
      403,
      `Access denied. Required role(s): ${roles.join(', ')}.`,
    )
  }

  next()
}

/**
 * optionalAuth — attaches req.user if a valid token is present,
 * but does NOT block the request if no token is provided.
 * Useful for public routes that have slightly different behaviour
 * for authenticated users (e.g. leaderboard showing your own rank).
 */
import { extractBearerToken, verifyAccessToken } from '../services/tokenService.js'
import { User } from '../models/index.js'

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization)
    if (!token) return next()

    const decoded = verifyAccessToken(token)
    const user    = await User.findById(decoded.id).select('-passwordHash -refreshToken')

    if (user && user.status === 'active') {
      req.user = user
    }
  } catch {
    // silently ignore — optional auth never blocks
  }
  next()
}

export { requireAdmin, requireRole, optionalAuth }
export default requireAdmin
