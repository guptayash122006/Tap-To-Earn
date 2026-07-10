import { verifyAccessToken, extractBearerToken } from '../services/tokenService.js'
import { User } from '../models/index.js'
import ApiResponse from '../utils/apiResponse.js'

/**
 * protect — verifies JWT access token, loads user, attaches to req.user.
 *
 * Flow:
 *  1. Extract Bearer token from Authorization header
 *  2. Verify signature + expiry
 *  3. Load full user document (excluding passwordHash)
 *  4. Check user account is active (not banned/suspended)
 *  5. Attach user to req.user
 */
const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization)

    if (!token) {
      return ApiResponse.error(res, 401, 'Access denied. No token provided.')
    }

    // Verify token — throws on invalid/expired
    let decoded
    try {
      decoded = verifyAccessToken(token)
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return ApiResponse.error(res, 401, 'Token expired. Please refresh your session.')
      }
      return ApiResponse.error(res, 401, 'Invalid token.')
    }

    // Load fresh user from DB (not just the JWT payload)
    const user = await User.findById(decoded.id).select('-passwordHash -refreshToken')

    if (!user) {
      return ApiResponse.error(res, 401, 'User account not found.')
    }

    // Account status check
    if (user.status === 'banned') {
      return ApiResponse.error(res, 403, `Your account has been banned. Reason: ${user.banReason || 'Policy violation'}`)
    }

    if (user.status === 'suspended') {
      return ApiResponse.error(res, 403, 'Your account is temporarily suspended. Contact support.')
    }

    // Attach user and decoded payload to request
    req.user    = user
    req.tokenId = decoded.jti || null

    next()
  } catch (err) {
    return ApiResponse.error(res, 500, 'Authentication error. Please try again.')
  }
}

export default protect
