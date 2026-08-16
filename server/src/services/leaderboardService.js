import { User, Coin, LeaderboardEntry } from '../models/index.js'

/**
 * Rebuild the materialized LeaderboardEntry snapshot table.
 * Aggregates live User and Coin wallet statistics, writes them,
 * and calls the model static methods to recalculate rank numbers.
 */
export const rebuildLeaderboard = async () => {
  // 1. Fetch active users and all wallets
  const users = await User.find({ status: 'active' }).select('username avatar level').lean()
  const wallets = await Coin.find().lean()
  const walletMap = new Map(wallets.map(w => [w.userId.toString(), w]))

  // 2. Map data to leaderboard entries
  const entries = users.map(user => {
    const wallet = walletMap.get(user._id.toString()) || {
      totalEarned: 0,
      earnedToday: 0,
      earnedThisWeek: 0,
      earnedThisMonth: 0,
    }
    return {
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      level: user.level,
      totalCoins: wallet.totalEarned,
      coinsToday: wallet.earnedToday,
      coinsThisWeek: wallet.earnedThisWeek,
      coinsThisMonth: wallet.earnedThisMonth,
    }
  })

  // 3. Upsert into database
  const bulkOps = entries.map(entry => ({
    updateOne: {
      filter: { userId: entry.userId },
      update: { $set: entry },
      upsert: true,
    },
  }))

  if (bulkOps.length > 0) {
    await LeaderboardEntry.bulkWrite(bulkOps)
  }

  // 4. Recalculate rank numbers on LeaderboardEntry
  await LeaderboardEntry.rebuildRanks('allTime')
  await LeaderboardEntry.rebuildRanks('daily')
  await LeaderboardEntry.rebuildRanks('weekly')
  await LeaderboardEntry.rebuildRanks('monthly')
}

/**
 * Get leaderboard top list and current user's rank.
 * Automatically triggers rebuild if the leaderboard is empty.
 */
export const getLeaderboard = async (userId, period = 'allTime', limit = 100) => {
  const count = await LeaderboardEntry.countDocuments()
  if (count === 0) {
    await rebuildLeaderboard()
  }

  const leaderboard = await LeaderboardEntry.getTopN(period, limit)
  const userRank = await LeaderboardEntry.getUserRank(userId)

  return {
    leaderboard,
    userRank: userRank || null,
  }
}
