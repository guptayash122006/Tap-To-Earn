import mongoose from 'mongoose'

const withdrawalSchema = new mongoose.Schema(
  {
    // ── Requester ─────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Request Details ───────────────────────────────────
    coinsRequested: {
      type: Number,
      required: [true, 'Withdrawal amount is required'],
      min: [1000, 'Minimum withdrawal is 1,000 coins'],
    },
    conversionRate: {
      type: Number,
      default: 0.001,  // 1 coin = $0.001 by default
      min: 0,
    },
    fiatAmount: {
      type: Number,
      default: 0,      // calculated: coinsRequested * conversionRate
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },

    // ── Payment Method ────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ['upi', 'paypal', 'bank_transfer', 'crypto', 'gift_card'],
      required: [true, 'Payment method is required'],
    },
    paymentDetails: {
      // UPI
      upiId: { type: String, default: null },
      // PayPal
      paypalEmail: { type: String, default: null },
      // Bank Transfer
      bankName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      ifscCode: { type: String, default: null },
      accountHolderName: { type: String, default: null },
      // Crypto
      walletAddress: { type: String, default: null },
      cryptoCurrency: { type: String, default: null },
      // Gift Card
      giftCardType: { type: String, default: null },
    },

    // ── Status Flow: pending → approved | rejected ────────
    status: {
      type: String,
      enum: ['pending', 'processing', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    statusHistory: [
      {
        status: { type: String },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String },
      },
    ],

    // ── Admin Fields ──────────────────────────────────────
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    transactionReference: {
      type: String,   // payment gateway transaction ID
      default: null,
    },

    // ── Linked Transaction ────────────────────────────────
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },

    // ── User metadata at time of request ─────────────────
    snapshotCoinsAtRequest: {
      type: Number,
      default: 0,
    },

    // ── Request origin ────────────────────────────────────
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ── Pre-save: auto-calculate fiat amount ──────────────────
withdrawalSchema.pre('save', function (next) {
  if (this.isModified('coinsRequested') || this.isModified('conversionRate')) {
    this.fiatAmount = parseFloat((this.coinsRequested * this.conversionRate).toFixed(4))
  }
  next()
})

// ── Indexes ───────────────────────────────────────────────
withdrawalSchema.index({ userId: 1, createdAt: -1 })
withdrawalSchema.index({ status: 1, createdAt: -1 })       // admin queue
withdrawalSchema.index({ processedBy: 1 })
withdrawalSchema.index({ createdAt: -1 })
withdrawalSchema.index({ userId: 1, status: 1 })

// ── Virtuals ──────────────────────────────────────────────
withdrawalSchema.virtual('isPending').get(function () {
  return this.status === 'pending'
})

withdrawalSchema.virtual('isProcessed').get(function () {
  return ['approved', 'rejected', 'cancelled'].includes(this.status)
})

// ── Static Methods ─────────────────────────────────────────
withdrawalSchema.statics.getPendingCount = function () {
  return this.countDocuments({ status: 'pending' })
}

withdrawalSchema.statics.getTotalPaidOut = function () {
  return this.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: null, totalCoins: { $sum: '$coinsRequested' }, totalFiat: { $sum: '$fiatAmount' } } },
  ])
}

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalSchema)
export default WithdrawalRequest
