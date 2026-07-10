import mongoose from 'mongoose'

/**
 * Referral — tracks referrer → referee relationships and bonus payouts.
 * Each accepted referral link creates exactly one document.
 */
const referralSchema = new mongoose.Schema(
  {
    // ── Relationship ──────────────────────────────────────
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referredId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,    // a user can only be referred once
    },
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
    },

    // ── Bonus Tracking ────────────────────────────────────
    // Referee welcome bonus
    refereeBonusAmount: {
      type: Number,
      default: 20,
      min: 0,
    },
    refereeBonusPaid: {
      type: Boolean,
      default: false,
    },
    refereeBonusPaidAt: {
      type: Date,
      default: null,
    },

    // Referrer activation bonus (paid after referee's first tap)
    referrerBonusAmount: {
      type: Number,
      default: 50,
      min: 0,
    },
    referrerBonusPaid: {
      type: Boolean,
      default: false,
    },
    referrerBonusPaidAt: {
      type: Date,
      default: null,
    },

    // Referrer ongoing commission (% of referee's earnings)
    commissionRate: {
      type: Number,
      default: 0,      // 0% by default, can be enabled in future
      min: 0,
      max: 100,
    },
    totalCommissionEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Activation Trigger ────────────────────────────────
    isActivated: {
      type: Boolean,
      default: false,
      comment: 'True after referee completes first tap',
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    firstTapAt: {
      type: Date,
      default: null,
    },

    // ── Linked Transactions ───────────────────────────────
    referrerTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    refereeTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },

    // ── Source / Attribution ──────────────────────────────
    source: {
      type: String,
      enum: ['link', 'code', 'social', 'qr'],
      default: 'code',
    },
    utmParams: {
      utm_source: { type: String, default: null },
      utm_medium: { type: String, default: null },
      utm_campaign: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ── Compound unique: one referral relationship per pair ───
referralSchema.index({ referrerId: 1, referredId: 1 }, { unique: true })
referralSchema.index({ referrerId: 1, createdAt: -1 })
referralSchema.index({ referralCode: 1 })
referralSchema.index({ isActivated: 1 })
// referredId indexed via unique:true on field definition

// ── Virtuals ──────────────────────────────────────────────
referralSchema.virtual('allBonusesPaid').get(function () {
  return this.refereeBonusPaid && this.referrerBonusPaid
})

// ── Static Methods ────────────────────────────────────────
referralSchema.statics.getReferrerStats = function (referrerId) {
  return this.aggregate([
    { $match: { referrerId: new mongoose.Types.ObjectId(referrerId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        activated: { $sum: { $cond: ['$isActivated', 1, 0] } },
        totalBonusEarned: { $sum: '$referrerBonusAmount' },
        totalCommission: { $sum: '$totalCommissionEarned' },
      },
    },
  ])
}

const Referral = mongoose.model('Referral', referralSchema)
export default Referral
