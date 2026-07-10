import jwt from 'jsonwebtoken'
import env from '../config/env.js'

/**
 * Token Service — handles signing and verification of JWT access
 * and refresh tokens. All token logic is centralised here.
 */

// ── Sign Tokens ───────────────────────────────────────────

/**
 * Signs a short-lived access token.
 * @param {Object} payload - Must include { id, role }
 */
export const signAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer:    'tap-to-earn',
    audience:  'tap-to-earn-client',
  })
}

/**
 * Signs a long-lived refresh token.
 * @param {Object} payload - Must include { id }
 */
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer:    'tap-to-earn',
    audience:  'tap-to-earn-client',
  })
}

/**
 * Signs both tokens at once.
 * @returns {{ accessToken, refreshToken }}
 */
export const signTokenPair = (user) => {
  const payload = { id: user._id.toString(), role: user.role }
  return {
    accessToken:  signAccessToken(payload),
    refreshToken: signRefreshToken({ id: user._id.toString() }),
  }
}

// ── Verify Tokens ─────────────────────────────────────────

/**
 * Verifies an access token.
 * @throws jwt.JsonWebTokenError | jwt.TokenExpiredError
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer:   'tap-to-earn',
    audience: 'tap-to-earn-client',
  })
}

/**
 * Verifies a refresh token.
 * @throws jwt.JsonWebTokenError | jwt.TokenExpiredError
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer:   'tap-to-earn',
    audience: 'tap-to-earn-client',
  })
}

// ── Cookie Helpers ────────────────────────────────────────
export const REFRESH_COOKIE_NAME = 'refreshToken'

export const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly:  true,
    secure:    env.isProd,
    sameSite:  env.isProd ? 'strict' : 'lax',
    maxAge:    7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path:      '/api/auth/refresh',       // cookie only sent to refresh endpoint
  })
}

export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth/refresh' })
}

// ── Parse Bearer Token ────────────────────────────────────
export const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}
