import mongoose from 'mongoose'

/**
 * Ad — defines available advertisements users can watch for coin rewards.
 * AdView — tracks each user's ad interaction history to enforce cooldowns
 * and daily limits.
 */
const adSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Ad title is required'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    advertiser: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // ── Content ───────────────────────────────────────────
    type: {
      type: String,
      enum: ['video', 'rewarded_video', 'interstitial', 'banner'],
      default: 'rewarded_video',
    },
    adNetwork: {
      type: String,
      enum: ['admob', 'unity_ads', 'applovin', 'ironsource', 'custom', 'internal'],
      default: 'internal',
    },
    adNetworkId: {
      type: String,
      default: null,
    },
    videoUrl: {
      type: String,
      default: null,
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    clickUrl: {
      type: String,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 30,
      min: 5,
      max: 120,
    },

    // ── Reward ────────────────────────────────────────────
    rewardCoins: {
      type: Number,
      required: [true, 'Reward coins is required'],
      min: [1, 'Reward must be at least 1 coin'],
      default: 10,
    },
    rewardEnergy: {
      type: Number,
      default: 0,
    },

    // ── Limits & Cooldowns ────────────────────────────────
    maxViewsPerUserPerDay: {
      type: Number,
      default: 5,
      min: 1,
    },
    cooldownMinutes: {
      type: Number,
      default: 60,
      min: 0,
      comment: 'Minimum minutes between two views of this ad',
    },

    // ── Targeting ─────────────────────────────────────────
    targetMinLevel: {
      type: Number,
      default: 1,
    },
    targetMaxLevel: {
      type: Number,
      default: null,
    },
    targetCountries: {
      type: [String],
      default: [],   // empty = all countries
    },

    // ── Status ────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
      comment: 'Higher priority ads shown first',
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },

    // ── Performance Stats ─────────────────────────────────
    stats: {
      totalViews: { type: Number, default: 0 },
      totalRewardsPaid: { type: Number, default: 0 },
      totalCoinsAwarded: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 }, // % who watched to end
    },

    // ── Meta ──────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ── Indexes ────────────────────────────────────────────────
adSchema.index({ isActive: 1, priority: -1 })
adSchema.index({ adNetwork: 1 })
adSchema.index({ endDate: 1 })

// ── Virtuals ──────────────────────────────────────────────
adSchema.virtual('isExpired').get(function () {
  if (!this.endDate) return false
  return new Date() > new Date(this.endDate)
})

adSchema.virtual('isAvailable').get(function () {
  if (!this.isActive || this.isExpired) return false
  if (this.startDate && new Date() < new Date(this.startDate)) return false
  return true
})

// ── Static Methods ─────────────────────────────────────────
adSchema.statics.getActiveAds = function (userLevel = 1) {
  return this.find({
    isActive: true,
    targetMinLevel: { $lte: userLevel },
    $or: [{ targetMaxLevel: null }, { targetMaxLevel: { $gte: userLevel } }],
    $or: [{ endDate: null }, { endDate: { $gt: new Date() } }],
    $or: [{ startDate: null }, { startDate: { $lte: new Date() } }],
  })
    .sort({ priority: -1 })
    .lean()
}

/**
 * AdView — logs every ad view event per user.
 */
const adViewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ad',
      required: true,
    },
    watchedAt: {
      type: Date,
      default: Date.now,
    },
    watchedDurationSeconds: {
      type: Number,
      required: true,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    rewardGranted: {
      type: Boolean,
      default: false,
    },
    rewardCoins: {
      type: Number,
      default: 0,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    date: {
      type: String,  // 'YYYY-MM-DD' for daily view count queries
      default: () => new Date().toISOString().slice(0, 10),
    },
  },
  {
    timestamps: true,
  }
)

adViewSchema.index({ userId: 1, adId: 1, date: 1 })    // daily limit check
adViewSchema.index({ userId: 1, date: 1 })              // daily total per user
adViewSchema.index({ adId: 1, watchedAt: -1 })          // ad analytics
adViewSchema.index({ userId: 1, watchedAt: -1 })        // user ad history

const Ad = mongoose.model('Ad', adSchema)
const AdView = mongoose.model('AdView', adViewSchema)

export { Ad, AdView }
export default Ad
