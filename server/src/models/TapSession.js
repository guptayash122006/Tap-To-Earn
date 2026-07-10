import mongoose from 'mongoose'

/**
 * TapSession — stores every tap batch with full anti-cheat metadata.
 * Immutable after creation — append-only audit log of all tap activity.
 */
const tapSessionSchema = new mongoose.Schema(
  {
    // ── Owner ─────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Session / Batch Identity ──────────────────────────
    sessionId: {
      type: String,
      required: true,
      comment: 'Client-generated UUID for the tap session',
    },
    batchIndex: {
      type: Number,
      default: 0,
      comment: 'Incrementing batch number within a session',
    },

    // ── Tap Data ──────────────────────────────────────────
    tapCount: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      comment: 'Number of taps in this batch (max 10)',
    },
    coinsEarned: {
      type: Number,
      required: true,
      min: 0,
    },
    energyBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    energyAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Timing Analysis (anti-cheat) ──────────────────────
    tapIntervals: {
      type: [Number],
      default: [],
      comment: 'Milliseconds between consecutive taps in this batch',
    },
    avgInterval: {
      type: Number,
      default: null,
      comment: 'Average ms between taps',
    },
    minInterval: {
      type: Number,
      default: null,
      comment: 'Fastest interval observed',
    },
    maxInterval: {
      type: Number,
      default: null,
      comment: 'Slowest interval observed',
    },
    stdDeviation: {
      type: Number,
      default: null,
      comment: 'Statistical standard deviation of intervals — low value = bot pattern',
    },

    // ── Anti-cheat Verdict ────────────────────────────────
    isSuspicious: {
      type: Boolean,
      default: false,
    },
    suspicionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    suspicionReasons: {
      type: [String],
      default: [],
    },
    rewardMultiplier: {
      type: Number,
      default: 1,
      comment: 'Reduced to 0.5 for flagged sessions',
    },

    // ── Timestamp Analysis ────────────────────────────────
    clientTimestamp: {
      type: Date,
      required: true,
    },
    serverTimestamp: {
      type: Date,
      default: Date.now,
    },
    timeDrift: {
      type: Number,
      default: 0,
      comment: 'Absolute difference between client and server time in ms',
    },

    // ── Request Metadata ──────────────────────────────────
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },

    // ── Linked Transaction ────────────────────────────────
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true, // no extra fields
  }
)

// ── Indexes ───────────────────────────────────────────────
tapSessionSchema.index({ userId: 1, serverTimestamp: -1 })   // user tap history
tapSessionSchema.index({ userId: 1, sessionId: 1 })           // session lookup
tapSessionSchema.index({ isSuspicious: 1 })                   // admin suspicious filter
tapSessionSchema.index({ serverTimestamp: -1 })               // global timeline
tapSessionSchema.index({ ipAddress: 1, serverTimestamp: -1 }) // IP-based analysis

// ── Static: total taps in a time window ───────────────────
/**
 * Returns total tapCount for a user in the last `windowMs` milliseconds.
 * Used for real-time velocity enforcement.
 */
tapSessionSchema.statics.getRecentTapRate = async function (userId, windowMs = 5000) {
  const since = new Date(Date.now() - windowMs)
  const result = await this.aggregate([
    {
      $match: {
        userId:          new mongoose.Types.ObjectId(userId),
        serverTimestamp: { $gte: since },
      },
    },
    {
      $group: {
        _id:       null,
        totalTaps: { $sum: '$tapCount' },
      },
    },
  ])
  return result[0]?.totalTaps || 0
}

/**
 * Aggregation: analyse a user's historical tap patterns.
 * Returns { avgStdDev, avgInterval, totalSessions, suspiciousCount }
 */
tapSessionSchema.statics.analyzeUserPattern = function (userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id:              null,
        avgStdDev:        { $avg: '$stdDeviation' },
        avgInterval:      { $avg: '$avgInterval' },
        totalSessions:    { $sum: 1 },
        suspiciousCount:  { $sum: { $cond: ['$isSuspicious', 1, 0] } },
        totalTaps:        { $sum: '$tapCount' },
      },
    },
  ])
}

/**
 * Returns tap count for a user on a specific calendar date.
 */
tapSessionSchema.statics.getDailyTapCount = async function (userId, date = new Date()) {
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end   = new Date(date); end.setHours(23, 59, 59, 999)
  const result = await this.aggregate([
    {
      $match: {
        userId:          new mongoose.Types.ObjectId(userId),
        serverTimestamp: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$tapCount' } } },
  ])
  return result[0]?.total || 0
}

const TapSession = mongoose.model('TapSession', tapSessionSchema)
export default TapSession
