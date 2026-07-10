import mongoose from 'mongoose'

/**
 * Transaction — immutable ledger of every coin movement.
 * Never update or delete records; append only.
 */
const transactionSchema = new mongoose.Schema(
  {
    // ── Parties ───────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Classification ────────────────────────────────────
    type: {
      type: String,
      enum: [
        'tap',            // earned by tapping
        'referral_bonus', // referrer reward
        'referral_join',  // referee welcome bonus
        'daily_reward',   // daily streak reward
        'task_reward',    // task completion reward
        'ad_reward',      // watched an ad
        'withdrawal',     // coins deducted for withdrawal
        'withdrawal_refund', // coins refunded on withdrawal rejection
        'admin_grant',    // admin manually added coins
        'admin_deduct',   // admin manually removed coins
        'level_up_bonus', // bonus for leveling up
        'penalty',        // system penalty
      ],
      required: true,
    },
    category: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },

    // ── Amount ────────────────────────────────────────────
    amount: {
      type: Number,
      required: true,
      min: [0, 'Transaction amount must be positive'],
    },

    // ── Balance Snapshot (after this transaction) ─────────
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Context / References ──────────────────────────────
    description: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      comment: 'Links to withdrawal, task, referral, etc.',
    },
    referenceModel: {
      type: String,
      enum: ['WithdrawalRequest', 'Task', 'Referral', 'DailyReward', 'Ad', null],
      default: null,
    },

    // ── Metadata ──────────────────────────────────────────
    metadata: {
      tapCount: { type: Number, default: null },   // for batched taps
      streakDay: { type: Number, default: null },  // for daily rewards
      adId: { type: String, default: null },       // for ad rewards
      taskTitle: { type: String, default: null },  // for task rewards
      adminNote: { type: String, default: null },  // for admin grants
      ipAddress: { type: String, default: null },
    },

    // ── Status ────────────────────────────────────────────
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed', 'reversed'],
      default: 'completed',
    },
  },
  {
    timestamps: true,
    // Prevent accidental updates to ledger
    strict: true,
  }
)

// ── Indexes ───────────────────────────────────────────────
transactionSchema.index({ userId: 1, createdAt: -1 })    // user history (most common)
transactionSchema.index({ userId: 1, type: 1 })          // filter by type
transactionSchema.index({ type: 1, createdAt: -1 })      // admin: all of a type
transactionSchema.index({ referenceId: 1 })              // lookup by reference
transactionSchema.index({ status: 1 })                   // filter by status
transactionSchema.index({ createdAt: -1 })               // global timeline

// ── Static Helpers ────────────────────────────────────────
transactionSchema.statics.getUserHistory = function (userId, { page = 1, limit = 20, type } = {}) {
  const filter = { userId }
  if (type) filter.type = type
  return this.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
}

transactionSchema.statics.getUserTotals = function (userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ])
}

const Transaction = mongoose.model('Transaction', transactionSchema)
export default Transaction
