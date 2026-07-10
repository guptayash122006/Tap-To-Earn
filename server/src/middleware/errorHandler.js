import env from '../config/env.js'

/**
 * Global error handler — MUST be registered LAST in Express middleware chain.
 *
 * Handles:
 *  - Mongoose validation errors     → 422
 *  - Mongoose duplicate key errors  → 409
 *  - Mongoose cast errors           → 400
 *  - JWT errors                     → 401
 *  - Generic errors                 → 500
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500
  let message    = err.message    || 'Internal Server Error'
  let errors     = null

  // ── Domain-specific error codes ───────────────────────────
  const CODE_TO_STATUS = {
    // Tap errors
    ENERGY_EMPTY:              400,
    LIMIT_REACHED:             403,
    AUTO_CLICK_DETECTED:       429,
    // Auth errors
    USER_NOT_FOUND:            404,
    ACCOUNT_INACTIVE:          403,
    // Withdrawal errors
    BELOW_MINIMUM:             400,
    WALLET_NOT_FOUND:          404,
    INSUFFICIENT_BALANCE:      400,
    PENDING_EXISTS:            409,
    INVALID_STATUS_TRANSITION: 409,
    // Referral errors
    FRAUD_DETECTED:            403,
    // General
    NOT_FOUND:                 404,
    FORBIDDEN:                 403,
  }
  if (err.code && CODE_TO_STATUS[err.code]) {
    statusCode = CODE_TO_STATUS[err.code]
  }

  // ── Mongoose Validation Error ──────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 422
    message    = 'Validation failed.'
    errors     = Object.values(err.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }))
  }

  // ── Mongoose Duplicate Key (E11000) ────────────────────
  else if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    message = `${capitalise(field)} already exists.`
  }

  // ── Mongoose CastError (invalid ObjectId, etc.) ────────
  else if (err.name === 'CastError') {
    statusCode = 400
    message    = `Invalid value for field '${err.path}'.`
  }

  // ── JWT Errors ─────────────────────────────────────────
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message    = 'Invalid token.'
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message    = 'Token expired. Please refresh your session.'
  }

  // ── Log in development ─────────────────────────────────
  if (env.isDev) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${statusCode}: ${message}`)
    if (err.stack) console.error(err.stack)
  }

  // ── Always hide stack in production ───────────────────
  const payload = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(env.isDev && { stack: err.stack }),
  }

  return res.status(statusCode).json(payload)
}

const capitalise = (str) => str.charAt(0).toUpperCase() + str.slice(1)

export default errorHandler
