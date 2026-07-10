import mongoose from 'mongoose'

/**
 * LeaderboardEntry — materialized view for fast leaderboard reads.
 * Rebuilt by cron jobs; do not use as source of truth for coins (use Coin model).
 *
 * Strategy: Store pre-computed ranks for each period to avoid expensive
 * real-time sorting across millions of users.
 */
const leaderboardEntrySchema = new mongoose.Schema(
  {
    // ── Player ────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Snapshot (denormalized for query speed) ───────────
    username: { type: String, required: true },
    avatar: { type: String, default: null },
    level: { type: Number, default: 1 },

    // ── Coin Metrics ──────────────────────────────────────
    totalCoins: {
      type: Number,
      default: 0,
    },
    coinsToday: {
      type: Number,
      default: 0,
    },
    coinsThisWeek: {
      type: Number,
      default: 0,
    },
    coinsThisMonth: {
      type: Number,
      default: 0,
    },

    // ── Rankings ──────────────────────────────────────────
    rankAllTime: { type: Number, default: null },
    rankDaily: { type: Number, default: null },
    rankWeekly: { type: Number, default: null },
    rankMonthly: { type: Number, default: null },

    // ── Previous Rankings (for movement arrows) ───────────
    prevRankAllTime: { type: Number, default: null },
    prevRankDaily: { type: Number, default: null },
    prevRankWeekly: { type: Number, default: null },
    prevRankMonthly: { type: Number, default: null },

    // ── Period Identifiers ────────────────────────────────
    dailyDate: {
      type: String,  // 'YYYY-MM-DD'
      default: null,
    },
    weekId: {
      type: String,  // 'YYYY-WW'
      default: null,
    },
    monthId: {
      type: String,  // 'YYYY-MM'
      default: null,
    },

    // ── Refresh Metadata ──────────────────────────────────
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

// ── Indexes ───────────────────────────────────────────────
leaderboardEntrySchema.index({ userId: 1 }, { unique: true })
leaderboardEntrySchema.index({ totalCoins: -1 })          // all-time board
leaderboardEntrySchema.index({ coinsToday: -1 })          // daily board
leaderboardEntrySchema.index({ coinsThisWeek: -1 })       // weekly board
leaderboardEntrySchema.index({ coinsThisMonth: -1 })      // monthly board
leaderboardEntrySchema.index({ rankAllTime: 1 })
leaderboardEntrySchema.index({ rankDaily: 1 })

// ── Static Methods ────────────────────────────────────────
leaderboardEntrySchema.statics.getTopN = function (period = 'allTime', n = 100) {
  const sortField = {
    allTime: 'totalCoins',
    daily: 'coinsToday',
    weekly: 'coinsThisWeek',
    monthly: 'coinsThisMonth',
  }[period] || 'totalCoins'

  return this.find()
    .sort({ [sortField]: -1 })
    .limit(n)
    .populate('userId', 'username avatar level')
    .lean()
}

leaderboardEntrySchema.statics.getUserRank = function (userId) {
  return this.findOne({ userId }).lean()
}

leaderboardEntrySchema.statics.rebuildRanks = async function (period = 'allTime') {
  const sortField = {
    allTime: 'totalCoins',
    daily: 'coinsToday',
    weekly: 'coinsThisWeek',
    monthly: 'coinsThisMonth',
  }[period]

  const rankField = {
    allTime: 'rankAllTime',
    daily: 'rankDaily',
    weekly: 'rankWeekly',
    monthly: 'rankMonthly',
  }[period]

  const entries = await this.find().sort({ [sortField]: -1 }).select('_id userId').lean()
  const bulkOps = entries.map((entry, index) => ({
    updateOne: {
      filter: { _id: entry._id },
      update: { $set: { [rankField]: index + 1, lastUpdatedAt: new Date() } },
    },
  }))
  if (bulkOps.length > 0) await this.bulkWrite(bulkOps)
}

const LeaderboardEntry = mongoose.model('LeaderboardEntry', leaderboardEntrySchema)
export default LeaderboardEntry
