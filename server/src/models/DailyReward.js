import mongoose from 'mongoose'

/**
 * DailyReward — defines the 7-day streak reward schedule.
 * Seeded once on startup; typically 7 documents (one per day).
 */
const dailyRewardSchema = new mongoose.Schema(
  {
    // ── Day number (1–7, loops after 7) ───────────────────
    day: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      max: 7,
    },

    // ── Reward ────────────────────────────────────────────
    rewardCoins: {
      type: Number,
      required: true,
      min: 1,
    },
    rewardEnergy: {
      type: Number,
      default: 0,
      min: 0,
    },
    bonusMultiplier: {
      type: Number,
      default: 1,
      min: 1,
      comment: '2x on day 7 = double coins',
    },

    // ── Display ───────────────────────────────────────────
    label: {
      type: String,
      default: null,   // e.g., 'Bonus Day!', 'Streak Milestone!'
    },
    icon: {
      type: String,
      default: null,
    },
    isSpecial: {
      type: Boolean,
      default: false,  // highlights day 7 visually
    },
  },
  {
    timestamps: true,
  }
)

// day is indexed via unique:true on field definition

// ── Static: get config for a streak day ──────────────────
dailyRewardSchema.statics.getForStreak = function (streakCount) {
  const day = ((streakCount - 1) % 7) + 1   // clamp to 1–7
  return this.findOne({ day }).lean()
}

// ── Static: seed default rewards if missing ───────────────
dailyRewardSchema.statics.seedDefaults = async function () {
  const defaults = [
    { day: 1, rewardCoins: 50,  label: 'Day 1',        isSpecial: false },
    { day: 2, rewardCoins: 75,  label: 'Day 2',        isSpecial: false },
    { day: 3, rewardCoins: 100, label: 'Day 3',        isSpecial: false },
    { day: 4, rewardCoins: 150, label: 'Day 4',        isSpecial: false },
    { day: 5, rewardCoins: 200, label: 'Day 5',        isSpecial: false },
    { day: 6, rewardCoins: 250, label: 'Day 6',        isSpecial: false },
    { day: 7, rewardCoins: 500, label: 'Streak Bonus!', isSpecial: true, bonusMultiplier: 2 },
  ]
  for (const reward of defaults) {
    await this.findOneAndUpdate({ day: reward.day }, reward, { upsert: true })
  }
}

/**
 * DailyClaimLog — records each user's daily reward claim event.
 * Provides full history for auditing and analytics.
 */
const dailyClaimLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    streakCount: {
      type: Number,
      required: true,
    },
    coinsAwarded: {
      type: Number,
      required: true,
    },
    energyAwarded: {
      type: Number,
      default: 0,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    claimDate: {
      type: String,   // 'YYYY-MM-DD' for uniqueness enforcement
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// ── One claim per user per calendar day ───────────────────
dailyClaimLogSchema.index({ userId: 1, claimDate: 1 }, { unique: true })
dailyClaimLogSchema.index({ userId: 1, claimedAt: -1 })
dailyClaimLogSchema.index({ claimedAt: -1 })

const DailyReward = mongoose.model('DailyReward', dailyRewardSchema)
const DailyClaimLog = mongoose.model('DailyClaimLog', dailyClaimLogSchema)

export { DailyReward, DailyClaimLog }
export default DailyReward
