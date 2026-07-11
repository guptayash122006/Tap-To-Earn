/**
 * adRewardService.js — Server-side ad reward validation.
 *
 * This service is the authoritative gatekeeper for all ad-derived rewards.
 * The client CANNOT grant itself any reward — it must call this service
 * and the service will decide whether the reward is valid.
 *
 * SECURITY MEASURES:
 *   1. Session token de-duplication — prevents replay attacks
 *   2. Hourly rate limiting per user (max 5 rewarded ads/hr)
 *   3. Timestamp validation — rejects stale requests (>2 min old)
 *   4. Reward type whitelist — ONLY 'energy' is allowed; never coins/balance
 *   5. Energy is capped at max energy — cannot overflow
 *   6. No Transaction record is created (ad energy ≠ earned coins)
 *   7. No Coin.availableBalance is modified (non-withdrawable)
 *
 * POLICY COMPLIANCE:
 *   - Google AdSense Program Policies §2 (Invalid clicks / impressions)
 *   - Google H5 Games Ads Rewarded Placement Policy
 *   - Network policies: no monetary rewards for ad views
 */

import mongoose from 'mongoose'
import { User, Coin } from '../models/index.js'
import { AD_REWARD } from '../config/constants.js'

// ── In-memory session token store (production: use Redis) ──────
// Maps sessionToken → { userId, usedAt }
const usedTokens = new Map()

// Cleanup old tokens every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [token, meta] of usedTokens.entries()) {
    if (meta.usedAt < cutoff) usedTokens.delete(token)
  }
}, 10 * 60 * 1000)

// ── Per-user rate tracking (production: use Redis sorted sets) ─
// Maps userId → [{ ts }]
const userAdLog = new Map()

function getUserAdLog(userId) {
  const key  = userId.toString()
  const now  = Date.now()
  const hour = now - 3_600_000

  if (!userAdLog.has(key)) userAdLog.set(key, [])
  // Prune old entries
  const log = userAdLog.get(key).filter(e => e.ts > hour)
  userAdLog.set(key, log)
  return log
}

// ── WHITELIST of allowed reward types ─────────────────────────
const ALLOWED_REWARD_TYPES = new Set(['energy'])

// ── PROHIBITED reward types (failsafe) ────────────────────────
const PROHIBITED_REWARD_TYPES = new Set([
  'coins', 'coin', 'balance', 'withdrawable', 'fiat', 'usd', 'money',
  'withdrawable_coins', 'available_balance',
])

// ─────────────────────────────────────────────────────────────
// VALIDATE & GRANT AD REWARD
// ─────────────────────────────────────────────────────────────
/**
 * validateAndGrantAdReward — the single entry point for all ad reward grants.
 *
 * @param {string} userId         — authenticated user's ID
 * @param {object} params
 * @param {string} params.rewardType     — must be 'energy'
 * @param {number} params.energyAmount   — energy to grant (capped at config max)
 * @param {string} params.sessionToken   — one-time token from client
 * @param {number} params.timestamp      — client timestamp (ms)
 * @param {string} params.placementName  — ad placement identifier
 * @param {string} params.ipAddress      — requester IP for fraud detection
 * @returns {Promise<{ energyGranted: number, newEnergy: number, message: string }>}
 */
export const validateAndGrantAdReward = async (userId, {
  rewardType,
  energyAmount,
  sessionToken,
  timestamp,
  placementName,
  ipAddress = null,
}) => {
  // ── 1. Reward type whitelist ──────────────────────────────
  const rewardLower = (rewardType || '').toLowerCase()

  if (PROHIBITED_REWARD_TYPES.has(rewardLower)) {
    const err = new Error(
      `POLICY VIOLATION: Reward type "${rewardType}" is prohibited. ` +
      `Ad rewards must not affect withdrawable coin balance per Google AdSense policies.`
    )
    err.code = 'PROHIBITED_REWARD_TYPE'
    throw err
  }

  if (!ALLOWED_REWARD_TYPES.has(rewardLower)) {
    const err = new Error(`Invalid reward type "${rewardType}". Only "energy" is permitted.`)
    err.code  = 'INVALID_REWARD_TYPE'
    throw err
  }

  // ── 2. Session token replay prevention ───────────────────
  if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.length < 8) {
    const err = new Error('Invalid or missing session token.')
    err.code  = 'INVALID_TOKEN'
    throw err
  }

  if (usedTokens.has(sessionToken)) {
    const err = new Error('This ad session has already been rewarded. Replay attack prevented.')
    err.code  = 'DUPLICATE_TOKEN'
    throw err
  }

  // ── 3. Timestamp staleness check ─────────────────────────
  const now        = Date.now()
  const MAX_AGE_MS = 2 * 60 * 1000   // 2 minutes
  if (!timestamp || Math.abs(now - timestamp) > MAX_AGE_MS) {
    const err = new Error('Request timestamp is too old or invalid. Please try again.')
    err.code  = 'STALE_TIMESTAMP'
    throw err
  }

  // ── 4. Per-user hourly rate limit ────────────────────────
  const log = getUserAdLog(userId)
  if (log.length >= AD_REWARD.MAX_PER_HOUR) {
    const err = new Error(
      `Hourly rewarded ad limit reached (${AD_REWARD.MAX_PER_HOUR}/hr). ` +
      `This prevents invalid traffic per Google AdSense Program Policies.`
    )
    err.code  = 'RATE_LIMITED'
    throw err
  }

  // ── 5. Per-ad cooldown check ─────────────────────────────
  const last        = log[log.length - 1]
  const cooldownMs  = AD_REWARD.COOLDOWN_SEC * 1000
  if (last && (now - last.ts) < cooldownMs) {
    const waitSec = Math.ceil((cooldownMs - (now - last.ts)) / 1000)
    const err     = new Error(`Please wait ${waitSec}s before claiming another energy reward.`)
    err.code      = 'COOLDOWN_ACTIVE'
    err.waitSec   = waitSec
    throw err
  }

  // ── 6. User exists and is active ─────────────────────────
  const user = await User.findById(userId).select('status').lean()
  if (!user) {
    const err = new Error('User not found.'); err.code = 'USER_NOT_FOUND'; throw err
  }
  if (user.status !== 'active') {
    const err = new Error('Account is not active.'); err.code = 'ACCOUNT_INACTIVE'; throw err
  }

  // ── 7. Cap energy amount ──────────────────────────────────
  const cappedAmount = Math.min(
    Math.max(1, parseInt(energyAmount) || 0),
    AD_REWARD.MAX_ENERGY_GRANT
  )

  // ── 8. Grant energy (NOT coins) ──────────────────────────
  // Energy is stored directly on the user document (session field).
  // It is NOT added to Coin.availableBalance.
  // Energy resets on server schedule — it is purely a gameplay mechanic.
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $min:  { energy: AD_REWARD.MAX_ENERGY },           // cap at max
      $set:  { lastAdRewardAt: new Date() },
    },
    { new: true }
  )

  // Calculate how much energy was actually granted
  // (if already at max, no energy is added — and that's fine)
  let newEnergy = Math.min((updatedUser?.energy || 0) + cappedAmount, AD_REWARD.MAX_ENERGY)

  await User.findByIdAndUpdate(userId, { $set: { energy: newEnergy } })

  // ── 9. Mark token as used ─────────────────────────────────
  usedTokens.set(sessionToken, { userId: userId.toString(), usedAt: now })

  // ── 10. Record in rate log ────────────────────────────────
  log.push({ ts: now, placement: placementName, ipAddress })
  userAdLog.set(userId.toString(), log)

  return {
    energyGranted: cappedAmount,
    newEnergy,
    maxEnergy:     AD_REWARD.MAX_ENERGY,
    message:       `+${cappedAmount} energy granted. Keep tapping! ⚡`,
    remainingAdsThisHour: AD_REWARD.MAX_PER_HOUR - log.length,
  }
}

/**
 * getAdStatus — returns the user's current ad rate limit status.
 * Used by the frontend to decide whether to show the "Watch Ad" button.
 */
export const getAdStatus = async (userId) => {
  const log          = getUserAdLog(userId)
  const last         = log[log.length - 1]
  const now          = Date.now()
  const cooldownMs   = AD_REWARD.COOLDOWN_SEC * 1000
  const waitSec      = last ? Math.max(0, Math.ceil((cooldownMs - (now - last.ts)) / 1000)) : 0

  const user = await User.findById(userId).select('energy').lean()

  return {
    canWatch:           log.length < AD_REWARD.MAX_PER_HOUR && waitSec === 0,
    adsWatchedThisHour: log.length,
    maxPerHour:         AD_REWARD.MAX_PER_HOUR,
    cooldownSeconds:    waitSec,
    currentEnergy:      user?.energy || 0,
    maxEnergy:          AD_REWARD.MAX_ENERGY,
    energyReward:       AD_REWARD.ENERGY_AMOUNT,
  }
}
