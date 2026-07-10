import rateLimit from 'express-rate-limit'
import ApiResponse from '../utils/apiResponse.js'

const rateLimitResponse = (req, res) => {
  return ApiResponse.error(
    res,
    429,
    'Too many requests. Please slow down and try again later.',
  )
}

// ── Global API limiter (all routes) ──────────────────────
export const globalLimiter = rateLimit({
  windowMs:          60 * 1000,   // 1 minute
  max:               100,
  standardHeaders:   true,
  legacyHeaders:     false,
  handler:           rateLimitResponse,
  skip:              (req) => req.ip === '127.0.0.1' && process.env.NODE_ENV === 'test',
})

// ── Auth-specific limiter (login, register, refresh) ─────
export const authLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,  // 15 minutes
  max:               10,               // 10 attempts per window
  standardHeaders:   true,
  legacyHeaders:     false,
  handler:           rateLimitResponse,
  message:           'Too many authentication attempts. Try again in 15 minutes.',
  skipSuccessfulRequests: true,        // don't count successful logins
})

// ── Tap-specific limiter (prevent server flooding) ────────
export const tapLimiter = rateLimit({
  windowMs:          1000,           // 1 second window
  max:               10,             // max 10 taps/sec per IP
  standardHeaders:   true,
  legacyHeaders:     false,
  keyGenerator:      (req) => req.user?._id?.toString() || req.ip,
  handler:           rateLimitResponse,
})

// ── Withdrawal limiter (prevent spam requests) ────────────
export const withdrawalLimiter = rateLimit({
  windowMs:          60 * 60 * 1000,  // 1 hour
  max:               5,
  standardHeaders:   true,
  legacyHeaders:     false,
  keyGenerator:      (req) => req.user?._id?.toString() || req.ip,
  handler:           rateLimitResponse,
})

// ── Admin limiter (heavier operations) ────────────────────
export const adminLimiter = rateLimit({
  windowMs:          60 * 1000,      // 1 minute
  max:               200,            // admins get more headroom
  standardHeaders:   true,
  legacyHeaders:     false,
  keyGenerator:      (req) => req.user?._id?.toString() || req.ip,
  handler:           rateLimitResponse,
})
