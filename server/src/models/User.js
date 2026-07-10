import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // never returned in queries by default
    },
    avatar: {
      type: String,
      default: null, // URL to avatar image
    },

    // ── Role & Status ─────────────────────────────────────
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'banned', 'suspended'],
      default: 'active',
    },
    banReason: {
      type: String,
      default: null,
    },
    bannedAt: {
      type: Date,
      default: null,
    },

    // ── Game Stats ────────────────────────────────────────
    totalCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTaps: {
      type: Number,
      default: 0,
      min: 0,
    },
    tapPower: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    experience: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Energy System ─────────────────────────────────────
    energy: {
      type: Number,
      default: 100,
      min: 0,
    },
    maxEnergy: {
      type: Number,
      default: 100,
      min: 10,
      max: 1000,
    },
    energyRefillRate: {
      type: Number,
      default: 1,       // units per refill tick
      min: 1,
    },
    lastEnergyRefillAt: {
      type: Date,
      default: Date.now,
    },

    // ── Daily Reward ──────────────────────────────────────
    dailyStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastDailyClaimAt: {
      type: Date,
      default: null,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Referral ──────────────────────────────────────────
    referralCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referralBonusPaid: {
      type: Boolean,
      default: false,
    },
    totalReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },
    referralEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Ads ───────────────────────────────────────────────
    totalAdsWatched: {
      type: Number,
      default: 0,
    },
    adsWatchedToday: {
      type: Number,
      default: 0,
    },
    lastAdWatchedAt: {
      type: Date,
      default: null,
    },
    adCooldownUntil: {
      type: Date,
      default: null,
    },

    // ── Tasks ─────────────────────────────────────────────
    completedTasks: [
      {
        taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
        completedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Tokens ───────────────────────────────────────────
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    // ── Timestamps ────────────────────────────────────────
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    lastLoginIp: {
      type: String,
      default: null,
      // Used for anti-fraud referral checks
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ── Indexes ──────────────────────────────────────────────
// email, username, referralCode are indexed via unique:true — no duplicate needed
userSchema.index({ referredBy: 1 })
userSchema.index({ totalCoins: -1 })         // leaderboard queries
userSchema.index({ status: 1, role: 1 })     // admin filters
userSchema.index({ createdAt: -1 })
userSchema.index({ lastLoginIp: 1 })         // anti-fraud IP checks

// ── Virtuals ─────────────────────────────────────────────
userSchema.virtual('isEnergyFull').get(function () {
  return this.energy >= this.maxEnergy
})

userSchema.virtual('canClaimDailyReward').get(function () {
  if (!this.lastDailyClaimAt) return true
  const now = new Date()
  const last = new Date(this.lastDailyClaimAt)
  return now.toDateString() !== last.toDateString()
})

// ── Instance Methods ─────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash)
}

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.passwordHash
  delete obj.refreshToken
  delete obj.refreshTokenExpiresAt
  return obj
}

// ── Static Methods ────────────────────────────────────────
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+passwordHash')
}

userSchema.statics.findByReferralCode = function (code) {
  return this.findOne({ referralCode: code.toUpperCase() })
}

// ── Pre-save Hooks ────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next()
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
  next()
})

const User = mongoose.model('User', userSchema)
export default User
