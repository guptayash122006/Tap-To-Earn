import mongoose from 'mongoose'
import { User, Coin, Transaction, Referral, TapSession } from '../models/index.js'
import { REFERRAL, STATUS } from '../config/constants.js'
import generateReferralCode from '../utils/generateReferralCode.js'

// ─────────────────────────────────────────────────────────────
// ANTI-FRAUD CHECKS
// ─────────────────────────────────────────────────────────────

/**
 * detectFakeReferral — runs before rewarding the referrer.
 * Returns { isFraudulent, reasons[] }.
 *
 * Checks:
 *  1. Self-referral (already blocked at register, double-check)
 *  2. Referee account too new (< MIN_ACCOUNT_AGE_HOURS)
 *  3. Referee has not reached activity threshold
 *  4. IP flooding: too many referrals from same IP as referee
 *  5. Referrer or referee is banned/suspended
 */
export const detectFakeReferral = async (referral, referee) => {
  const reasons = []

  // ── 1. Self-referral ──────────────────────────────────────
  if (String(referral.referrerId) === String(referral.referredId)) {
    reasons.push('self_referral')
  }

  // ── 2. Account age check ──────────────────────────────────
  const ageHours = (Date.now() - new Date(referee.createdAt).getTime()) / 3_600_000
  if (ageHours < REFERRAL.MIN_ACCOUNT_AGE_HOURS) {
    reasons.push(`account_too_new:${ageHours.toFixed(2)}h`)
  }

  // ── 3. Activity threshold (tap count) ─────────────────────
  if (referee.totalTaps < REFERRAL.ACTIVITY_THRESHOLD_TAPS) {
    reasons.push(`insufficient_activity:${referee.totalTaps}/${REFERRAL.ACTIVITY_THRESHOLD_TAPS}`)
  }

  // ── 4. IP flood check (too many referrals from same IP) ───
  if (referee.lastLoginIp) {
    const ipCount = await User.countDocuments({
      lastLoginIp: referee.lastLoginIp,
      _id:         { $ne: referee._id },
      createdAt:   { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
    })
    if (ipCount >= REFERRAL.MAX_REFERRALS_PER_IP) {
      reasons.push(`ip_flood:${ipCount}accounts_from_${referee.lastLoginIp}`)
    }
  }

  // ── 5. Account status ─────────────────────────────────────
  if (referee.status !== STATUS.ACTIVE) {
    reasons.push(`referee_status:${referee.status}`)
  }
  const referrer = await User.findById(referral.referrerId).select('status')
  if (referrer && referrer.status !== STATUS.ACTIVE) {
    reasons.push(`referrer_status:${referrer.status}`)
  }

  return {
    isFraudulent: reasons.length > 0,
    reasons,
  }
}

// ─────────────────────────────────────────────────────────────
// GENERATE / GET REFERRAL CODE
// ─────────────────────────────────────────────────────────────

/**
 * getUserReferralInfo — returns the user's code, link, and stats.
 */
export const getUserReferralInfo = async (userId) => {
  const user = await User.findById(userId)
    .select('username referralCode totalReferrals')
    .lean()

  if (!user) {
    const err = new Error('User not found.'); err.code = 'USER_NOT_FOUND'; throw err
  }

  // Ensure user has a referral code (shouldn't happen, but safety net)
  let code = user.referralCode
  if (!code) {
    let unique = false
    while (!unique) {
      code = generateReferralCode()
      unique = !(await User.exists({ referralCode: code }))
    }
    await User.findByIdAndUpdate(userId, { referralCode: code })
  }

  // Build referral link
  const referralLink = `${REFERRAL.LINK_BASE}/${code}`

  // Aggregate stats from Referral collection
  const [stats] = await Referral.getReferrerStats(userId)

  return {
    referralCode:   code,
    referralLink,
    totalReferrals: stats?.total       || 0,
    activated:      stats?.activated   || 0,
    pending:        (stats?.total || 0) - (stats?.activated || 0),
    coinsEarned:    stats?.totalBonusEarned || 0,
    commissionEarned: stats?.totalCommission || 0,
  }
}

// ─────────────────────────────────────────────────────────────
// VALIDATE A REFERRAL CODE (public, no auth)
// ─────────────────────────────────────────────────────────────

/**
 * validateReferralCode — checks if a code is valid before registration.
 */
export const validateReferralCode = async (code) => {
  const referrer = await User.findByReferralCode(code.toUpperCase())

  if (!referrer) {
    return { valid: false, message: 'Referral code not found.' }
  }
  if (referrer.status !== STATUS.ACTIVE) {
    return { valid: false, message: 'This referral code belongs to an inactive account.' }
  }

  return {
    valid:       true,
    referrerName: referrer.username,
    message:     `Valid! You'll receive ${REFERRAL.REFEREE_BONUS} bonus coins on joining.`,
  }
}

// ─────────────────────────────────────────────────────────────
// GET MY REFERRAL LIST
// ─────────────────────────────────────────────────────────────

/**
 * getMyReferrals — paginated list of users referred by the caller.
 */
export const getMyReferrals = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit

  const [referrals, total] = await Promise.all([
    Referral.find({ referrerId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('referredId', 'username createdAt totalTaps')
      .lean(),
    Referral.countDocuments({ referrerId: userId }),
  ])

  const formatted = referrals.map(r => ({
    id:              r._id,
    username:        r.referredId?.username || 'Unknown',
    joinedAt:        r.createdAt,
    totalTaps:       r.referredId?.totalTaps || 0,
    isActivated:     r.isActivated,
    activatedAt:     r.activatedAt,
    referrerBonus:   r.referrerBonusAmount,
    bonusPaid:       r.referrerBonusPaid,
    progressPct:     Math.min(100, Math.round(
                       ((r.referredId?.totalTaps || 0) / REFERRAL.ACTIVITY_THRESHOLD_TAPS) * 100
                     )),
    tapsNeeded:      Math.max(0, REFERRAL.ACTIVITY_THRESHOLD_TAPS - (r.referredId?.totalTaps || 0)),
  }))

  return {
    referrals: formatted,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    activityThreshold: REFERRAL.ACTIVITY_THRESHOLD_TAPS,
  }
}

// ─────────────────────────────────────────────────────────────
// TRIGGER REFERRER BONUS (called from tap service)
// ─────────────────────────────────────────────────────────────

/**
 * checkAndTriggerReferrerBonus — called after every tap batch.
 * If the referee has just crossed the activity threshold AND the
 * referrer bonus hasn't been paid yet, pay it now atomically.
 *
 * Returns { triggered, coinsAwarded } — silent failure (never throws).
 */
export const checkAndTriggerReferrerBonus = async (refereeUserId) => {
  try {
    // Find the referral record where this user is the referee
    const referral = await Referral.findOne({
      referredId:       refereeUserId,
      referrerBonusPaid: false,
      isActivated:       false,
    })

    if (!referral) return { triggered: false }

    // Load referee to check activity + fraud
    const referee = await User.findById(refereeUserId)
      .select('totalTaps status createdAt lastLoginIp username')

    if (!referee) return { triggered: false }

    // Has the referee crossed the threshold?
    if (referee.totalTaps < REFERRAL.ACTIVITY_THRESHOLD_TAPS) {
      return { triggered: false }
    }

    // Anti-fraud check
    const fraudCheck = await detectFakeReferral(referral, referee)
    if (fraudCheck.isFraudulent) {
      // Mark as fraudulent but don't pay — log the reasons
      await Referral.findByIdAndUpdate(referral._id, {
        $set: {
          isActivated: false,
          // Store fraud metadata without paying
        },
      })
      console.warn(`[Referral] Fraud detected for referral ${referral._id}:`, fraudCheck.reasons)
      return { triggered: false, fraud: true, reasons: fraudCheck.reasons }
    }

    // ── Atomic payout ─────────────────────────────────────────
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // 1. Credit coins to referrer
      const referrerWallet = await Coin.creditCoins(
        referral.referrerId,
        REFERRAL.REFERRER_BONUS,
        'referral',
        session,
      )

      // 2. Create transaction record for referrer
      const [txn] = await Transaction.create(
        [
          {
            userId:        referral.referrerId,
            type:          'referral_bonus',
            category:      'credit',
            amount:        REFERRAL.REFERRER_BONUS,
            balanceBefore: referrerWallet.availableBalance - REFERRAL.REFERRER_BONUS,
            balanceAfter:  referrerWallet.availableBalance,
            description:   `Referral bonus: @${referee.username} reached ${REFERRAL.ACTIVITY_THRESHOLD_TAPS} taps`,
            metadata:      { refereeUserId, referralId: referral._id },
          },
        ],
        { session }
      )

      // 3. Mark referral as activated + paid
      await Referral.findByIdAndUpdate(
        referral._id,
        {
          $set: {
            isActivated:          true,
            activatedAt:          new Date(),
            firstTapAt:           new Date(),
            referrerBonusPaid:    true,
            referrerBonusPaidAt:  new Date(),
            referrerTransactionId: txn._id,
          },
        },
        { session }
      )

      await session.commitTransaction()

      return {
        triggered:    true,
        coinsAwarded: REFERRAL.REFERRER_BONUS,
        referrerId:   referral.referrerId,
      }
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }
  } catch (err) {
    // Never crash the tap flow because of referral payout
    console.error('[Referral] checkAndTriggerReferrerBonus error:', err.message)
    return { triggered: false }
  }
}

// ─────────────────────────────────────────────────────────────
// TOP REFERRERS LEADERBOARD
// ─────────────────────────────────────────────────────────────

/**
 * getTopReferrers — returns the top N users by total referral count.
 */
export const getTopReferrers = async (limit = 10) => {
  const results = await Referral.aggregate([
    { $group: {
        _id:            '$referrerId',
        totalReferrals: { $sum: 1 },
        activated:      { $sum: { $cond: ['$isActivated', 1, 0] } },
        coinsEarned:    { $sum: { $cond: ['$referrerBonusPaid', '$referrerBonusAmount', 0] } },
      },
    },
    { $sort: { totalReferrals: -1 } },
    { $limit: limit },
    { $lookup: {
        from:         'users',
        localField:   '_id',
        foreignField: '_id',
        as:           'user',
      },
    },
    { $unwind: '$user' },
    { $project: {
        userId:         '$_id',
        username:       '$user.username',
        totalReferrals: 1,
        activated:      1,
        coinsEarned:    1,
        referralCode:   '$user.referralCode',
      },
    },
  ])

  return results
}

// ─────────────────────────────────────────────────────────────
// REFERRAL STATS SUMMARY
// ─────────────────────────────────────────────────────────────

/**
 * getReferralStats — detailed stats for dashboard display.
 */
export const getReferralStats = async (userId) => {
  const [info, myReferrals] = await Promise.all([
    getUserReferralInfo(userId),
    getMyReferrals(userId, { page: 1, limit: 5 }),
  ])

  return {
    ...info,
    recentReferrals: myReferrals.referrals,
    activityThreshold: REFERRAL.ACTIVITY_THRESHOLD_TAPS,
    refereeBonus:      REFERRAL.REFEREE_BONUS,
    referrerBonus:     REFERRAL.REFERRER_BONUS,
  }
}
