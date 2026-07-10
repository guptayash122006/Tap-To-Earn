import mongoose from 'mongoose'

/**
 * AdminLog — immutable audit trail of every administrative action.
 * Never delete or update these records.
 */
const adminLogSchema = new mongoose.Schema(
  {
    // ── Actor ─────────────────────────────────────────────
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminUsername: {
      type: String,
      required: true,
    },

    // ── Action ────────────────────────────────────────────
    action: {
      type: String,
      enum: [
        // User management
        'user_ban',
        'user_unban',
        'user_suspend',
        'user_role_change',
        'user_coin_grant',
        'user_coin_deduct',
        'user_energy_reset',
        'user_password_reset',
        'user_delete',
        // Withdrawal management
        'withdrawal_approve',
        'withdrawal_reject',
        'withdrawal_cancel',
        // Task management
        'task_create',
        'task_update',
        'task_delete',
        'task_activate',
        'task_deactivate',
        // Ad management
        'ad_create',
        'ad_update',
        'ad_delete',
        'ad_activate',
        'ad_deactivate',
        // System
        'system_settings_update',
        'leaderboard_reset',
        'manual_cron_trigger',
        'broadcast_notification',
      ],
      required: true,
    },
    category: {
      type: String,
      enum: ['user', 'financial', 'content', 'system'],
      required: true,
    },

    // ── Target ────────────────────────────────────────────
    targetType: {
      type: String,
      enum: ['User', 'WithdrawalRequest', 'Task', 'Ad', 'System', null],
      default: null,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      comment: 'State of the target BEFORE the action was taken',
    },

    // ── Details ───────────────────────────────────────────
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
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

    // ── Severity ──────────────────────────────────────────
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
  },
  {
    timestamps: true,
    // Prevent any updates — audit logs are write-once
  }
)

// ── Indexes ────────────────────────────────────────────────
adminLogSchema.index({ adminId: 1, createdAt: -1 })
adminLogSchema.index({ action: 1, createdAt: -1 })
adminLogSchema.index({ targetType: 1, targetId: 1 })
adminLogSchema.index({ category: 1 })
adminLogSchema.index({ severity: 1 })
adminLogSchema.index({ createdAt: -1 })               // chronological view

// ── Static Helpers ─────────────────────────────────────────
adminLogSchema.statics.log = function ({
  adminId,
  adminUsername,
  action,
  category,
  targetType = null,
  targetId = null,
  description,
  changes = null,
  reason = null,
  severity = 'low',
  ipAddress = null,
  userAgent = null,
  targetSnapshot = null,
}) {
  return this.create({
    adminId,
    adminUsername,
    action,
    category,
    targetType,
    targetId,
    description,
    changes,
    reason,
    severity,
    ipAddress,
    userAgent,
    targetSnapshot,
  })
}

adminLogSchema.statics.getRecentActivity = function (limit = 50) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('adminId', 'username avatar')
    .lean()
}

/**
 * SystemSettings — platform-wide configurable parameters.
 * Stored as a single document (singleton pattern).
 */
const systemSettingsSchema = new mongoose.Schema(
  {
    // Singleton guard
    _id: { type: String, default: 'singleton' },

    // ── Game Config ───────────────────────────────────────
    game: {
      defaultTapPower: { type: Number, default: 1 },
      defaultMaxEnergy: { type: Number, default: 100 },
      energyRefillRateSeconds: { type: Number, default: 30 },
      maxAdsPerDay: { type: Number, default: 10 },
      adCooldownMinutes: { type: Number, default: 60 },
    },

    // ── Referral Config ───────────────────────────────────
    referral: {
      referrerBonus: { type: Number, default: 50 },
      refereeBonus: { type: Number, default: 20 },
      commissionRate: { type: Number, default: 0 },
    },

    // ── Daily Reward Config ───────────────────────────────
    dailyRewards: {
      day1: { type: Number, default: 50 },
      day2: { type: Number, default: 75 },
      day3: { type: Number, default: 100 },
      day4: { type: Number, default: 150 },
      day5: { type: Number, default: 200 },
      day6: { type: Number, default: 250 },
      day7: { type: Number, default: 500 },
    },

    // ── Withdrawal Config ─────────────────────────────────
    withdrawal: {
      minimumCoins: { type: Number, default: 1000 },
      conversionRate: { type: Number, default: 0.001 },
      currency: { type: String, default: 'USD' },
      processingDays: { type: Number, default: 3 },
    },

    // ── Maintenance ───────────────────────────────────────
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: null },

    // ── Meta ──────────────────────────────────────────────
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

systemSettingsSchema.statics.getSettings = function () {
  return this.findById('singleton').lean()
}

systemSettingsSchema.statics.updateSettings = function (updates, adminId) {
  return this.findByIdAndUpdate(
    'singleton',
    { ...updates, updatedBy: adminId },
    { new: true, upsert: true }
  )
}

const AdminLog = mongoose.model('AdminLog', adminLogSchema)
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema)

export { AdminLog, SystemSettings }
export default AdminLog
