import mongoose from 'mongoose'
import { User, Coin, Transaction, DailyReward, DailyClaimLog } from '../models/index.js'

/**
 * Fetch daily reward status for a user, including their streak, 
 * whether they can claim today, and the complete 7-day schedule.
 */
export const getDailyRewardStatus = async (userId) => {
  const user = await User.findById(userId).select(
    'dailyStreak lastDailyClaimAt longestStreak energy maxEnergy'
  )

  if (!user) {
    const err = new Error('User not found.')
    err.code = 'USER_NOT_FOUND'
    throw err
  }

  // Use the virtual field on the User model
  const canClaim = user.canClaimDailyReward

  // Fetch reward schedule
  const schedule = await DailyReward.find().sort({ day: 1 }).lean()

  return {
    streakCount: user.dailyStreak,
    longestStreak: user.longestStreak,
    lastClaimAt: user.lastDailyClaimAt,
    canClaim,
    schedule,
  }
}

/**
 * Claim the daily reward for the user. Credits coins, resets/increments streak,
 * logs a transaction, creates a DailyClaimLog, and increments user energy if applicable.
 */
export const claimDailyReward = async (userId) => {
  const user = await User.findById(userId)
  if (!user) {
    const err = new Error('User not found.')
    err.code = 'USER_NOT_FOUND'
    throw err
  }

  if (!user.canClaimDailyReward) {
    const err = new Error('You have already claimed your reward for today.')
    err.code = 'ALREADY_CLAIMED'
    throw err
  }

  const now = new Date()
  let newStreak = 1

  if (user.lastDailyClaimAt) {
    const lastClaimDate = new Date(user.lastDailyClaimAt)
    // Strip time to compare dates only
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000)
    const lastClaimDay = new Date(lastClaimDate.getFullYear(), lastClaimDate.getMonth(), lastClaimDate.getDate())

    if (lastClaimDay.getTime() === yesterdayDate.getTime()) {
      newStreak = user.dailyStreak + 1
    } else if (lastClaimDay.getTime() === todayDate.getTime()) {
      const err = new Error('You have already claimed your reward for today.')
      err.code = 'ALREADY_CLAIMED'
      throw err
    }
  }

  // Get reward details for this streak day (1-7 loop)
  const reward = await DailyReward.getForStreak(newStreak)
  if (!reward) {
    throw new Error(`Reward configuration not found for streak day: ${newStreak}`)
  }

  const coinsAwarded = reward.rewardCoins * (reward.bonusMultiplier || 1)
  const energyAwarded = reward.rewardEnergy || 0

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // 1. Credit wallet
    const wallet = await Coin.creditCoins(userId, coinsAwarded, 'daily_reward', session)
    const balanceBefore = (wallet.totalEarned - coinsAwarded) - wallet.totalSpent
    const balanceAfter = wallet.availableBalance

    // 2. Write transaction ledger
    const [txn] = await Transaction.create(
      [
        {
          userId,
          type: 'daily_reward',
          category: 'credit',
          amount: coinsAwarded,
          balanceBefore: Math.max(0, balanceBefore),
          balanceAfter: Math.max(0, balanceAfter),
          description: `Claimed daily reward for Day ${reward.day} (streak: ${newStreak})`,
          referenceId: reward._id,
          referenceModel: 'DailyReward',
          metadata: {
            streakDay: reward.day,
          },
        },
      ],
      { session }
    )

    // 3. Log the claim YYYY-MM-DD
    const claimDateStr = now.toISOString().split('T')[0]
    await DailyClaimLog.create(
      [
        {
          userId,
          day: reward.day,
          streakCount: newStreak,
          coinsAwarded,
          energyAwarded,
          claimDate: claimDateStr,
          transactionId: txn._id,
        },
      ],
      { session }
    )

    // 4. Update user model
    user.dailyStreak = newStreak
    user.longestStreak = Math.max(user.longestStreak || 0, newStreak)
    user.lastDailyClaimAt = now
    if (energyAwarded > 0) {
      user.energy = Math.min(user.maxEnergy, user.energy + energyAwarded)
    }

    await user.save({ session })

    await session.commitTransaction()

    return {
      streakCount: newStreak,
      coinsAwarded,
      energyAwarded,
      newBalance: balanceAfter,
      dayClaimed: reward.day,
      message: `Successfully claimed Day ${reward.day} daily reward of ${coinsAwarded} coins!`,
    }
  } catch (err) {
    await session.abortTransaction()
    // Handle index unique key conflicts
    if (err.code === 11000 && err.message.includes('claimDate')) {
      const dbErr = new Error('You have already claimed your reward for today.')
      dbErr.code = 'ALREADY_CLAIMED'
      throw dbErr
    }
    throw err
  } finally {
    session.endSession()
  }
}
