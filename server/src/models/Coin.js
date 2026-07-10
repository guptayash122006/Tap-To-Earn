import mongoose from 'mongoose'

/**
 * Coin Wallet — tracks every coin balance mutation with a full audit trail.
 * Each document represents the current wallet state for one user.
 * All coin changes go through Transactions; this model holds the live totals.
 */
const coinSchema = new mongoose.Schema(
  {
    // ── Owner ─────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,   // one wallet per user
    },

    // ── Balances ──────────────────────────────────────────
    totalEarned: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Cumulative coins ever earned (never decremented)',
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Cumulative coins ever spent/withdrawn',
    },
    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Spendable balance = totalEarned - totalSpent - pendingWithdrawals',
    },
    pendingWithdrawal: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Coins locked in pending withdrawal requests',
    },
    lockedBalance: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Coins locked by admin or dispute',
    },

    // ── Earnings Breakdown ────────────────────────────────
    earningsBySource: {
      tap: { type: Number, default: 0 },
      referral: { type: Number, default: 0 },
      dailyReward: { type: Number, default: 0 },
      task: { type: Number, default: 0 },
      ads: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      adminGrant: { type: Number, default: 0 },
    },

    // ── Daily Snapshot ────────────────────────────────────
    earnedToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    tapsToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastDailyResetAt: {
      type: Date,
      default: Date.now,
    },

    // ── Weekly / Monthly Totals (for leaderboard periods) ─
    earnedThisWeek: {
      type: Number,
      default: 0,
    },
    earnedThisMonth: {
      type: Number,
      default: 0,
    },
    weekResetAt: {
      type: Date,
      default: Date.now,
    },
    monthResetAt: {
      type: Date,
      default: Date.now,
    },

    // ── Version key for optimistic concurrency ────────────
    __v: { type: Number, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ── Indexes ──────────────────────────────────────────────
// userId indexed via unique:true
coinSchema.index({ availableBalance: -1 })   // for balance-based sorts
coinSchema.index({ totalEarned: -1 })        // all-time leaderboard
coinSchema.index({ earnedToday: -1 })        // daily leaderboard
coinSchema.index({ earnedThisWeek: -1 })     // weekly leaderboard

// ── Virtuals ──────────────────────────────────────────────
coinSchema.virtual('netBalance').get(function () {
  return this.availableBalance - this.lockedBalance
})

coinSchema.virtual('withdrawableBalance').get(function () {
  return Math.max(0, this.availableBalance - this.lockedBalance)
})

// ── Static Methods ────────────────────────────────────────
coinSchema.statics.getWallet = function (userId) {
  return this.findOne({ userId })
}

coinSchema.statics.creditCoins = async function (userId, amount, source = 'tap', session = null) {
  const opts = session ? { session } : {}
  return this.findOneAndUpdate(
    { userId },
    {
      $inc: {
        totalEarned: amount,
        availableBalance: amount,
        earnedToday: amount,
        earnedThisWeek: amount,
        earnedThisMonth: amount,
        [`earningsBySource.${source}`]: amount,
      },
    },
    { new: true, upsert: true, ...opts }
  )
}

coinSchema.statics.debitCoins = async function (userId, amount, session = null) {
  const opts = session ? { session } : {}
  return this.findOneAndUpdate(
    { userId, availableBalance: { $gte: amount } }, // atomic safety check
    {
      $inc: {
        totalSpent: amount,
        availableBalance: -amount,
      },
    },
    { new: true, ...opts }
  )
}

const Coin = mongoose.model('Coin', coinSchema)
export default Coin
