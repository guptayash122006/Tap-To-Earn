import mongoose from 'mongoose'
import { User, Coin, Transaction, TapSession } from '../models/index.js'
import { TAP, GAME } from '../config/constants.js'
// Lazy import to avoid circular dependency
let _checkAndTriggerReferrerBonus = null
const getReferralTrigger = async () => {
  if (!_checkAndTriggerReferrerBonus) {
    const mod = await import('./referralService.js')
    _checkAndTriggerReferrerBonus = mod.checkAndTriggerReferrerBonus
  }
  return _checkAndTriggerReferrerBonus
}

// ─────────────────────────────────────────────────────────────
// HELPER: Standard Deviation
// ─────────────────────────────────────────────────────────────
export const calculateStdDeviation = (intervals) => {
  if (!intervals || intervals.length < 2) return null
  const n    = intervals.length
  const mean = intervals.reduce((s, v) => s + v, 0) / n
  const variance = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n
  return Math.sqrt(variance)
}

// ─────────────────────────────────────────────────────────────
// ANTI-CHEAT ENGINE
// ─────────────────────────────────────────────────────────────
/**
 * detectCheating — analyses timing data and recent velocity to produce
 * a suspicion score (0–100). Score >= 60 flags; >= 90 blocks entirely.
 *
 * @param {string}   userId
 * @param {object}   payload
 * @param {number}   payload.tapCount
 * @param {number[]} payload.tapIntervals     — ms between taps
 * @param {string}   payload.clientTimestamp  — ISO 8601 string
 * @param {string}   payload.ipAddress
 * @returns {{ isSuspicious: boolean, score: number, reasons: string[],
 *             avgInterval: number|null, minInterval: number|null,
 *             maxInterval: number|null, stdDeviation: number|null,
 *             timeDrift: number }}
 */
export const detectCheating = async (userId, { tapCount, tapIntervals = [], clientTimestamp, ipAddress }) => {
  let score   = 0
  const reasons = []

  // ── 1. Timestamp drift check ──────────────────────────────
  const clientTs  = new Date(clientTimestamp).getTime()
  const serverTs  = Date.now()
  const timeDrift = Math.abs(serverTs - clientTs)

  if (timeDrift > TAP.TIMESTAMP_DRIFT_TOLERANCE_MS) {
    score += 30
    reasons.push(`timestamp_drift:${timeDrift}ms`)
  }

  // ── 2. Interval statistics ────────────────────────────────
  let avgInterval  = null
  let minInterval  = null
  let maxInterval  = null
  let stdDeviation = null

  if (tapIntervals.length >= 2) {
    avgInterval  = tapIntervals.reduce((s, v) => s + v, 0) / tapIntervals.length
    minInterval  = Math.min(...tapIntervals)
    maxInterval  = Math.max(...tapIntervals)
    stdDeviation = calculateStdDeviation(tapIntervals)

    // ── 2a. Superhuman speed: any interval < 80ms ─────────
    if (minInterval < TAP.MIN_HUMAN_INTERVAL_MS) {
      score += 40
      reasons.push(`superhuman_speed:${minInterval}ms`)
    }

    // ── 2b. Bot regularity: very low std deviation ────────
    if (stdDeviation !== null && stdDeviation < TAP.BOT_STD_DEV_THRESHOLD_MS) {
      score += 35
      reasons.push(`bot_pattern_regularity:σ=${stdDeviation.toFixed(2)}ms`)
    }
  }

  // ── 3. Velocity window check (DB query) ──────────────────
  const recentTaps = await TapSession.getRecentTapRate(userId, TAP.VELOCITY_WINDOW_MS)
  const projectedTotal = recentTaps + tapCount

  if (projectedTotal > TAP.VELOCITY_MAX_TAPS) {
    score += 50
    reasons.push(`velocity_exceeded:${projectedTotal}taps/${TAP.VELOCITY_WINDOW_MS}ms`)
  }

  // ── Cap score at 100 ─────────────────────────────────────
  score = Math.min(100, score)

  return {
    isSuspicious: score >= TAP.SUSPICIOUS_SCORE_FLAG,
    score,
    reasons,
    avgInterval,
    minInterval,
    maxInterval,
    stdDeviation,
    timeDrift,
  }
}

// ─────────────────────────────────────────────────────────────
// CORE TAP PROCESSOR
// ─────────────────────────────────────────────────────────────
/**
 * validateAndProcessTap — validates, anti-cheat checks, and atomically
 * records a tap batch in MongoDB.
 *
 * @throws Error with .code for specific failure types
 * @returns {{ coinsEarned, newEnergy, newTotalCoins, isSuspicious, suspicionScore, lifetimeTapsRemaining }}
 */
export const validateAndProcessTap = async (userId, {
  tapCount,
  sessionId,
  clientTimestamp,
  tapIntervals = [],
  energyAtClient,
  ipAddress = null,
  userAgent  = null,
}) => {
  // ── Load user ─────────────────────────────────────────────
  const user = await User.findById(userId).select(
    'energy maxEnergy totalTaps tapPower status username lastEnergyRefillAt energyRefillRate'
  )

  if (!user) {
    const err = new Error('User not found.'); err.code = 'USER_NOT_FOUND'; throw err
  }
  user.regenerateEnergy()
  if (user.status !== 'active') {
    const err = new Error('Account is not active.'); err.code = 'ACCOUNT_INACTIVE'; throw err
  }

  // ── Lifetime tap limit ────────────────────────────────────
  if (user.totalTaps >= TAP.LIFETIME_MAX) {
    const err = new Error(`You have reached the maximum of ${TAP.LIFETIME_MAX.toLocaleString()} lifetime taps.`)
    err.code = 'LIMIT_REACHED'
    throw err
  }

  // ── Energy check ──────────────────────────────────────────
  if (user.energy <= 0) {
    const err = new Error('Not enough energy. Please wait for it to refill.')
    err.code = 'ENERGY_EMPTY'
    throw err
  }

  // ── Clamp tapCount to available energy + remaining taps ───
  const remainingTaps = TAP.LIFETIME_MAX - user.totalTaps
  const clampedCount  = Math.min(tapCount, user.energy, remainingTaps, TAP.MAX_PER_BATCH)

  if (clampedCount <= 0) {
    const err = new Error('No taps can be processed.')
    err.code = 'ENERGY_EMPTY'
    throw err
  }

  // ── Anti-cheat analysis ───────────────────────────────────
  const cheatAnalysis = await detectCheating(userId, {
    tapCount: clampedCount,
    tapIntervals,
    clientTimestamp,
    ipAddress,
  })

  // Hard block for extreme cheating
  if (cheatAnalysis.score >= TAP.SUSPICIOUS_SCORE_BLOCK) {
    const err = new Error('Automated tapping detected. Please tap manually.')
    err.code   = 'AUTO_CLICK_DETECTED'
    err.score  = cheatAnalysis.score
    err.reasons = cheatAnalysis.reasons
    throw err
  }

  // Soft flag: reduce reward multiplier
  const rewardMultiplier = cheatAnalysis.isSuspicious
    ? TAP.REDUCED_REWARD_MULTIPLIER
    : 1

  // ── Calculate coins ───────────────────────────────────────
  const coinsEarned = Math.floor(clampedCount * user.tapPower * rewardMultiplier)

  // ── Atomic DB transaction ─────────────────────────────────
  const session = await mongoose.startSession()
  session.startTransaction()

  let savedTapSession
  try {
    // 1. Deduct energy, increment totalTaps
    const updatedUser = await User.findById(userId).session(session)
    updatedUser.regenerateEnergy()
    updatedUser.energy = Math.max(0, updatedUser.energy - clampedCount)
    updatedUser.totalTaps += clampedCount
    await updatedUser.save({ session })

    const energyAfter = updatedUser.energy

    // 2. Credit coins to wallet
    const wallet = await Coin.creditCoins(userId, coinsEarned, 'tap', session)

    // 3. Get wallet balance for transaction snapshot
    const balanceBefore = (wallet.totalEarned - coinsEarned) - wallet.totalSpent
    const balanceAfter  = wallet.availableBalance

    // 4. Create transaction ledger entry
    const [txn] = await Transaction.create(
      [
        {
          userId,
          type:          'tap',
          category:      'credit',
          amount:        coinsEarned,
          balanceBefore: Math.max(0, balanceBefore),
          balanceAfter:  Math.max(0, balanceAfter),
          description:   `Earned ${coinsEarned} coins from ${clampedCount} taps`,
          metadata: {
            tapCount: clampedCount,
          },
        },
      ],
      { session }
    )

    // 5. Save TapSession record (full audit trail)
    ;[savedTapSession] = await TapSession.create(
      [
        {
          userId,
          sessionId,
          tapCount:        clampedCount,
          coinsEarned,
          energyBefore:    user.energy,
          energyAfter,
          tapIntervals,
          avgInterval:     cheatAnalysis.avgInterval,
          minInterval:     cheatAnalysis.minInterval,
          maxInterval:     cheatAnalysis.maxInterval,
          stdDeviation:    cheatAnalysis.stdDeviation,
          isSuspicious:    cheatAnalysis.isSuspicious,
          suspicionScore:  cheatAnalysis.score,
          suspicionReasons: cheatAnalysis.reasons,
          rewardMultiplier,
          clientTimestamp: new Date(clientTimestamp),
          serverTimestamp: new Date(),
          timeDrift:       cheatAnalysis.timeDrift,
          ipAddress,
          userAgent,
          transactionId:   txn._id,
        },
      ],
      { session }
    )

    await session.commitTransaction()

    // ── Fire referral bonus check asynchronously ──────────
    // Non-blocking: never delays the tap response.
    // Triggers referrer bonus if referee just crossed the threshold.
    getReferralTrigger().then(trigger => {
      trigger(userId).catch(err =>
        console.error('[Referral] Bonus trigger error:', err.message)
      )
    })

    return {
      coinsEarned,
      newEnergy:              energyAfter,
      newTotalCoins:          balanceAfter,
      totalTaps:              updatedUser.totalTaps,
      isSuspicious:           cheatAnalysis.isSuspicious,
      suspicionScore:         cheatAnalysis.score,
      lifetimeTapsRemaining:  TAP.LIFETIME_MAX - updatedUser.totalTaps,
      tapSessionId:           savedTapSession._id,
    }

  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
}

// ─────────────────────────────────────────────────────────────
// GET TAP STATUS
// ─────────────────────────────────────────────────────────────
/**
 * getUserTapStatus — returns current tap state for a user.
 */
export const getUserTapStatus = async (userId) => {
  const user = await User.findById(userId).select(
    'energy maxEnergy totalTaps tapPower lastEnergyRefillAt energyRefillRate'
  )

  if (!user) {
    const err = new Error('User not found.'); err.code = 'USER_NOT_FOUND'; throw err
  }

  user.regenerateEnergy()
  await user.save()

  const todayTaps = await TapSession.getDailyTapCount(userId)

  return {
    energy:                 user.energy,
    maxEnergy:              user.maxEnergy,
    totalTaps:              user.totalTaps,
    todayTaps,
    tapPower:               user.tapPower,
    lifetimeTapsRemaining:  Math.max(0, TAP.LIFETIME_MAX - user.totalTaps),
    lifetimeMax:            TAP.LIFETIME_MAX,
    canTap:                 user.energy > 0 && user.totalTaps < TAP.LIFETIME_MAX,
    lastEnergyRefillAt:     user.lastEnergyRefillAt,
    energyRefillRateSec:    GAME.ENERGY_REFILL_INTERVAL_SEC,
  }
}
