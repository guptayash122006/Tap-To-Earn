import mongoose from 'mongoose'

/**
 * Task — defines available missions/quests users can complete for coin rewards.
 * Separate from task completion tracking (stored on User.completedTasks).
 */
const taskSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: [true, 'Task description is required'],
      trim: true,
      maxlength: 500,
    },
    icon: {
      type: String,
      default: null,   // emoji or icon URL
    },

    // ── Classification ────────────────────────────────────
    category: {
      type: String,
      enum: ['daily', 'weekly', 'one_time', 'special'],
      default: 'one_time',
    },
    type: {
      type: String,
      enum: [
        'tap_count',          // tap N times total
        'tap_today',          // tap N times today
        'referral',           // refer N friends
        'daily_streak',       // maintain N day streak
        'ad_watch',           // watch N ads
        'profile_complete',   // fill out profile
        'first_withdrawal',   // submit first withdrawal
        'reach_level',        // reach a specific level
        'social_share',       // share on social media
        'custom',             // manually completed by admin
      ],
      required: true,
    },

    // ── Requirements ──────────────────────────────────────
    requirement: {
      targetValue: {
        type: Number,
        default: 1,
        min: 1,
        comment: 'e.g., tap 100 times, refer 5 friends',
      },
      targetId: {
        type: String,
        default: null,
        comment: 'e.g., specific level number',
      },
    },

    // ── Reward ────────────────────────────────────────────
    rewardCoins: {
      type: Number,
      required: [true, 'Reward coins is required'],
      min: [1, 'Reward must be at least 1 coin'],
    },
    rewardEnergy: {
      type: Number,
      default: 0,
      min: 0,
    },
    rewardTapPower: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Bonus tap power awarded on completion',
    },

    // ── Availability ──────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    isRepeatable: {
      type: Boolean,
      default: false,   // for daily/weekly tasks
    },
    repeatIntervalHours: {
      type: Number,
      default: null,    // 24 for daily, 168 for weekly
    },
    maxCompletions: {
      type: Number,
      default: null,    // null = unlimited (for non-repeatable daily tasks)
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,   // null = never expires
    },

    // ── Ordering & Display ────────────────────────────────
    order: {
      type: Number,
      default: 0,
    },
    badge: {
      type: String,
      enum: ['new', 'hot', 'limited', null],
      default: null,
    },

    // ── Stats ─────────────────────────────────────────────
    totalCompletions: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCoinsAwarded: {
      type: Number,
      default: 0,
      min: 0,
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
taskSchema.index({ isActive: 1, category: 1 })
taskSchema.index({ type: 1 })
taskSchema.index({ order: 1 })
taskSchema.index({ endDate: 1 })   // TTL-like filtering

// ── Virtuals ──────────────────────────────────────────────
taskSchema.virtual('isExpired').get(function () {
  if (!this.endDate) return false
  return new Date() > new Date(this.endDate)
})

taskSchema.virtual('isAvailable').get(function () {
  if (!this.isActive) return false
  if (this.isExpired) return false
  if (this.startDate && new Date() < new Date(this.startDate)) return false
  return true
})

// ── Static Methods ─────────────────────────────────────────
taskSchema.statics.getActiveTasks = function (category = null) {
  const filter = {
    isActive: true,
    $or: [{ endDate: null }, { endDate: { $gt: new Date() } }],
    $or: [{ startDate: null }, { startDate: { $lte: new Date() } }],
  }
  if (category) filter.category = category
  return this.find(filter).sort({ order: 1, createdAt: -1 }).lean()
}

/**
 * UserTask — tracks each user's progress & completion of tasks.
 * Kept as a separate model to allow scalable per-user progress tracking.
 */
const userTaskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    rewardClaimed: {
      type: Boolean,
      default: false,
    },
    rewardClaimedAt: {
      type: Date,
      default: null,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    // For repeatable tasks
    completionCount: {
      type: Number,
      default: 0,
    },
    nextAvailableAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

userTaskSchema.index({ userId: 1, taskId: 1 }, { unique: true })
userTaskSchema.index({ userId: 1, isCompleted: 1 })
userTaskSchema.index({ taskId: 1 })
userTaskSchema.index({ nextAvailableAt: 1 })

const Task = mongoose.model('Task', taskSchema)
const UserTask = mongoose.model('UserTask', userTaskSchema)

export { Task, UserTask }
export default Task
