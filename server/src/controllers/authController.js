import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User, Coin, Referral, Transaction } from '../models/index.js'
import { signTokenPair, verifyRefreshToken, setRefreshCookie, clearRefreshCookie } from '../services/tokenService.js'
import generateReferralCode from '../utils/generateReferralCode.js'
import ApiResponse from '../utils/apiResponse.js'
import asyncHandler from '../utils/asyncHandler.js'
import { BCRYPT_ROUNDS, REFERRAL, GAME } from '../config/constants.js'

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
  const { username, email, password, referralCode } = req.body

  // ── Check for existing user ───────────────────────────
  const existingUser = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username }],
  })

  if (existingUser) {
    const conflict = existingUser.email === email.toLowerCase() ? 'email' : 'username'
    return ApiResponse.error(res, 409, `This ${conflict} is already registered.`)
  }

  // ── Resolve referral code ─────────────────────────────
  let referrer = null
  if (referralCode) {
    referrer = await User.findByReferralCode(referralCode)
    if (!referrer) {
      return ApiResponse.error(res, 400, 'Invalid referral code. Please check and try again.')
    }
    if (referrer.status !== 'active') {
      return ApiResponse.error(res, 400, 'Referral code belongs to a suspended account.')
    }
  }

  // ── Generate unique referral code for new user ────────
  let newReferralCode
  let codeExists = true
  while (codeExists) {
    newReferralCode = generateReferralCode()
    codeExists = await User.exists({ referralCode: newReferralCode })
  }

  // ── Hash password ─────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  // ── Create user + wallet + referral in a transaction ─
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Create user
    const [user] = await User.create(
      [
        {
          username,
          email:           email.toLowerCase(),
          passwordHash,
          referralCode:    newReferralCode,
          referredBy:      referrer ? referrer._id : null,
          energy:          GAME.DEFAULT_MAX_ENERGY,
          maxEnergy:       GAME.DEFAULT_MAX_ENERGY,
          tapPower:        GAME.DEFAULT_TAP_POWER,
          lastEnergyRefillAt: new Date(),
        },
      ],
      { session }
    )

    // Create coin wallet
    await Coin.create(
      [
        {
          userId:           user._id,
          availableBalance: referrer ? REFERRAL.REFEREE_BONUS : 0,
          totalEarned:      referrer ? REFERRAL.REFEREE_BONUS : 0,
          earningsBySource: { referral: referrer ? REFERRAL.REFEREE_BONUS : 0 },
        },
      ],
      { session }
    )

    // Handle referral relationship
    if (referrer) {
      // Create referral document
      await Referral.create(
        [
          {
            referrerId:          referrer._id,
            referredId:          user._id,
            referralCode:        newReferralCode,
            refereeBonusAmount:  REFERRAL.REFEREE_BONUS,
            refereeBonusPaid:    true,
            refereeBonusPaidAt:  new Date(),
            referrerBonusAmount: REFERRAL.REFERRER_BONUS,
          },
        ],
        { session }
      )

      // Log referee welcome bonus transaction
      const currentBalance = 0
      await Transaction.create(
        [
          {
            userId:        user._id,
            type:          'referral_join',
            category:      'credit',
            amount:        REFERRAL.REFEREE_BONUS,
            balanceBefore: currentBalance,
            balanceAfter:  currentBalance + REFERRAL.REFEREE_BONUS,
            description:   `Welcome bonus for joining via referral code ${referralCode}`,
          },
        ],
        { session }
      )

      // Increment referrer's total referral count
      await User.findByIdAndUpdate(
        referrer._id,
        { $inc: { totalReferrals: 1 } },
        { session }
      )
    }

    await session.commitTransaction()

    // ── Sign tokens ───────────────────────────────────────
    const { accessToken, refreshToken } = signTokenPair(user)

    // Save refresh token hash to user
    user.refreshToken          = refreshToken
    user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    user.lastLoginAt           = new Date()
    user.lastLoginIp           = req.ip || req.headers['x-forwarded-for'] || null
    await user.save()

    // Set HttpOnly refresh cookie
    setRefreshCookie(res, refreshToken)

    return ApiResponse.success(res, 201, 'Account created successfully! Welcome aboard 🎉', {
      user:        user.toSafeObject(),
      accessToken,
    })
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  // Load user with passwordHash (select: false by default)
  const user = await User.findByEmail(email)

  // Use identical error for wrong email or wrong password (prevents enumeration)
  const INVALID_MSG = 'Invalid email or password.'

  if (!user) {
    return ApiResponse.error(res, 401, INVALID_MSG)
  }

  // Check account status before verifying password
  if (user.status === 'banned') {
    return ApiResponse.error(res, 403, `Account banned. Reason: ${user.banReason || 'Policy violation'}`)
  }

  if (user.status === 'suspended') {
    return ApiResponse.error(res, 403, 'Account suspended. Please contact support.')
  }

  // Verify password
  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    return ApiResponse.error(res, 401, INVALID_MSG)
  }

  // Sign tokens
  const { accessToken, refreshToken } = signTokenPair(user)

  // Persist refresh token
  user.refreshToken          = refreshToken
  user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  user.lastLoginAt           = new Date()
  user.lastActiveAt          = new Date()
  user.lastLoginIp           = req.ip || req.headers['x-forwarded-for'] || null
  await user.save()

  setRefreshCookie(res, refreshToken)

  return ApiResponse.success(res, 200, 'Login successful. Welcome back! 👋', {
    user:        user.toSafeObject(),
    accessToken,
  })
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────
export const refresh = asyncHandler(async (req, res) => {
  // Refresh token comes from HttpOnly cookie
  const token = req.cookies?.refreshToken

  if (!token) {
    return ApiResponse.error(res, 401, 'No refresh token provided.')
  }

  let decoded
  try {
    decoded = verifyRefreshToken(token)
  } catch (err) {
    clearRefreshCookie(res)
    if (err.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 401, 'Session expired. Please log in again.')
    }
    return ApiResponse.error(res, 401, 'Invalid refresh token.')
  }

  // Load user and verify stored refresh token matches
  const user = await User.findById(decoded.id).select('+refreshToken +refreshTokenExpiresAt')

  if (!user || user.refreshToken !== token) {
    clearRefreshCookie(res)
    return ApiResponse.error(res, 401, 'Refresh token revoked or invalid. Please log in again.')
  }

  if (user.status !== 'active') {
    clearRefreshCookie(res)
    return ApiResponse.error(res, 403, 'Account is no longer active.')
  }

  // Issue new token pair (rotation)
  const { accessToken, refreshToken: newRefreshToken } = signTokenPair(user)

  user.refreshToken          = newRefreshToken
  user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  user.lastActiveAt          = new Date()
  await user.save()

  setRefreshCookie(res, newRefreshToken)

  return ApiResponse.success(res, 200, 'Token refreshed successfully.', { accessToken })
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  // Invalidate stored refresh token
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { refreshToken: null, refreshTokenExpiresAt: null },
    })
  }

  clearRefreshCookie(res)

  return ApiResponse.success(res, 200, 'Logged out successfully.')
})

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req, res) => {
  // req.user already attached by protect middleware (no passwordHash)
  const user = await User.findById(req.user._id)
    .select('-passwordHash -refreshToken -refreshTokenExpiresAt')
    .lean()

  // Also fetch coin wallet for full profile
  const wallet = await Coin.findOne({ userId: req.user._id }).lean()

  return ApiResponse.success(res, 200, 'Profile fetched successfully.', {
    user,
    wallet: wallet || null,
  })
})

// ─────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────────
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body

  const user = await User.findById(req.user._id).select('+passwordHash')

  const isMatch = await user.comparePassword(currentPassword)
  if (!isMatch) {
    return ApiResponse.error(res, 401, 'Current password is incorrect.')
  }

  user.passwordHash          = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  user.refreshToken          = null   // force re-login on all devices
  user.refreshTokenExpiresAt = null
  await user.save()

  clearRefreshCookie(res)

  return ApiResponse.success(res, 200, 'Password changed successfully. Please log in again.')
})
