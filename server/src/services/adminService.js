import mongoose from 'mongoose'
import {
  User, Coin, Transaction, WithdrawalRequest,
  Referral, AdminLog, TapSession, Task, UserTask,
} from '../models/index.js'
import { STATUS, ROLES } from '../config/constants.js'

// ─────────────────────────────────────────────────────────────
// DASHBOARD OVERVIEW
// ─────────────────────────────────────────────────────────────
export const getDashboardStats = async () => {
  const now         = new Date()
  const todayStart  = new Date(now.setHours(0, 0, 0, 0))
  const weekStart   = new Date(Date.now() - 7  * 864e5)
  const monthStart  = new Date(Date.now() - 30 * 864e5)

  const [
    totalUsers, activeUsers, bannedUsers, newUsersToday, newUsersWeek,
    totalCoinsInCirculation, pendingWithdrawals, totalWithdrawalsApproved,
    totalTransactions, tapsToday, tapSessionsToday,
    pendingWdCount, [coinStats], [withdrawalStats],
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: STATUS.ACTIVE }),
    User.countDocuments({ status: STATUS.BANNED }),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ createdAt: { $gte: weekStart } }),
    Coin.aggregate([{ $group: { _id: null, total: { $sum: '$availableBalance' } } }]),
    WithdrawalRequest.countDocuments({ status: 'pending' }),
    WithdrawalRequest.countDocuments({ status: 'approved' }),
    Transaction.countDocuments(),
    TapSession.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: null, taps: { $sum: '$tapCount' }, coins: { $sum: '$coinsEarned' } } },
    ]),
    TapSession.countDocuments({ createdAt: { $gte: todayStart } }),
    WithdrawalRequest.countDocuments({ status: 'pending' }),
    Coin.aggregate([{ $group: { _id: null, total: { $sum: '$availableBalance' } } }]),
    WithdrawalRequest.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, coins: { $sum: '$coinsRequested' }, usd: { $sum: '$fiatAmount' } } },
    ]),
  ])

  // New users last 7 days (daily breakdown)
  const userGrowth = await User.aggregate([
    { $match: { createdAt: { $gte: weekStart } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])

  // Withdrawal breakdown by status
  const wdByStatus = await WithdrawalRequest.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, totalCoins: { $sum: '$coinsRequested' } } },
  ])

  // Top earners today
  const topToday = await Coin.find()
    .sort({ earnedToday: -1 }).limit(5)
    .populate('userId', 'username')
    .lean()

  return {
    users: {
      total: totalUsers, active: activeUsers, banned: bannedUsers,
      newToday: newUsersToday, newThisWeek: newUsersWeek,
    },
    coins: {
      totalInCirculation: coinStats?.total || 0,
      tapsToday:     tapsToday[0]?.taps   || 0,
      coinsEarnedToday: tapsToday[0]?.coins || 0,
      tapSessionsToday,
    },
    withdrawals: {
      pending:       pendingWithdrawals,
      totalApproved: totalWithdrawalsApproved,
      totalPaidCoins: withdrawalStats?.coins || 0,
      totalPaidUsd:   parseFloat((withdrawalStats?.usd || 0).toFixed(2)),
      byStatus: wdByStatus,
    },
    transactions: { total: totalTransactions },
    userGrowth,
    topEarnersToday: topToday.map(c => ({
      username: c.userId?.username || 'Unknown',
      earnedToday: c.earnedToday,
    })),
  }
}

// ─────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────
export const getUsers = async ({ page = 1, limit = 20, search, status, role, sort = '-createdAt' } = {}) => {
  const skip   = (page - 1) * limit
  const filter = {}
  if (status) filter.status = status
  if (role)   filter.role   = role
  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email:    { $regex: search, $options: 'i' } },
    ]
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-passwordHash -refreshToken -refreshTokenExpiresAt')
      .lean(),
    User.countDocuments(filter),
  ])

  // Attach wallet data
  const userIds  = users.map(u => u._id)
  const wallets  = await Coin.find({ userId: { $in: userIds } }).lean()
  const walletMap = Object.fromEntries(wallets.map(w => [w.userId.toString(), w]))

  const enriched = users.map(u => ({
    ...u,
    wallet: walletMap[u._id.toString()] || null,
  }))

  return { users: enriched, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export const getUserById = async (userId) => {
  const [user, wallet, recentTxns, wdCount, referralStats] = await Promise.all([
    User.findById(userId).select('-passwordHash -refreshToken').lean(),
    Coin.findOne({ userId }).lean(),
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    WithdrawalRequest.countDocuments({ userId }),
    Referral.getReferrerStats(userId),
  ])
  if (!user) { const err = new Error('User not found'); err.code = 'NOT_FOUND'; throw err }
  return { user, wallet, recentTxns, wdCount, referralStats: referralStats[0] || {} }
}

export const banUser = async (userId, adminId, reason) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { status: STATUS.BANNED, banReason: reason, bannedAt: new Date() } },
    { new: true }
  )
  if (!user) { const err = new Error('User not found'); err.code = 'NOT_FOUND'; throw err }
  await AdminLog.create({ adminId, action: 'ban_user', targetUserId: userId, details: { reason } })
  return { message: `User @${user.username} has been banned.` }
}

export const unbanUser = async (userId, adminId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { status: STATUS.ACTIVE, banReason: null, bannedAt: null } },
    { new: true }
  )
  if (!user) { const err = new Error('User not found'); err.code = 'NOT_FOUND'; throw err }
  await AdminLog.create({ adminId, action: 'unban_user', targetUserId: userId })
  return { message: `User @${user.username} has been unbanned.` }
}

export const adjustUserCoins = async (userId, adminId, amount, reason) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const wallet = await Coin.findOne({ userId }).session(session)
    if (!wallet) throw new Error('User wallet not found')
    const isCredit = amount > 0
    const absAmount = Math.abs(amount)
    const before = wallet.availableBalance

    await Coin.findOneAndUpdate(
      { userId },
      { $inc: { availableBalance: amount, totalEarned: isCredit ? absAmount : 0, totalSpent: isCredit ? 0 : absAmount, 'earningsBySource.adminGrant': isCredit ? absAmount : 0 } },
      { session }
    )

    await Transaction.create([{
      userId, type: 'admin_adjustment', category: isCredit ? 'credit' : 'debit',
      amount: absAmount, balanceBefore: before, balanceAfter: before + amount,
      description: `Admin ${isCredit ? 'grant' : 'deduction'}: ${reason}`,
      metadata: { adminId },
    }], { session })

    await AdminLog.create([{ adminId, action: isCredit ? 'grant_coins' : 'deduct_coins', targetUserId: userId, details: { amount, reason } }], { session })
    await session.commitTransaction()
    return { message: `${isCredit ? '+' : ''}${amount} coins applied to user.` }
  } catch (err) { await session.abortTransaction(); throw err }
  finally { session.endSession() }
}

// ─────────────────────────────────────────────────────────────
// TRANSACTION ANALYTICS
// ─────────────────────────────────────────────────────────────
export const getAllTransactions = async ({ page = 1, limit = 30, type, category, userId: fUserId } = {}) => {
  const skip   = (page - 1) * limit
  const filter = {}
  if (type)     filter.type     = type
  if (category) filter.category = category
  if (fUserId)  filter.userId   = fUserId

  const [txns, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('userId', 'username email')
      .lean(),
    Transaction.countDocuments(filter),
  ])

  const summary = await Transaction.aggregate([
    { $group: {
        _id: '$type',
        count:      { $sum: 1 },
        totalCoins: { $sum: '$amount' },
    }},
    { $sort: { totalCoins: -1 } },
  ])

  return { transactions: txns, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }, summary }
}

// ─────────────────────────────────────────────────────────────
// REFERRAL ADMIN STATS
// ─────────────────────────────────────────────────────────────
export const getReferralAdminStats = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit

  const [topReferrers, recentReferrals, total, overallStats] = await Promise.all([
    Referral.aggregate([
      { $group: { _id: '$referrerId', total: { $sum: 1 }, activated: { $sum: { $cond: ['$isActivated', 1, 0] } }, coinsEarned: { $sum: { $cond: ['$referrerBonusPaid', '$referrerBonusAmount', 0] } } } },
      { $sort: { total: -1 } }, { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { username: '$user.username', total: 1, activated: 1, coinsEarned: 1 } },
    ]),
    Referral.find()
      .sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('referrerId', 'username')
      .populate('referredId', 'username createdAt totalTaps')
      .lean(),
    Referral.countDocuments(),
    Referral.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, activated: { $sum: { $cond: ['$isActivated', 1, 0] } }, totalBonusPaid: { $sum: { $cond: ['$referrerBonusPaid', '$referrerBonusAmount', 0] } } } },
    ]),
  ])

  return {
    overallStats: overallStats[0] || { total: 0, activated: 0, totalBonusPaid: 0 },
    topReferrers,
    recentReferrals,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS (charts)
// ─────────────────────────────────────────────────────────────
export const getAnalytics = async (days = 7) => {
  const since = new Date(Date.now() - days * 864e5)

  const [userGrowth, coinsEarned, withdrawalTrend, tapActivity] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    TapSession.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, coins: { $sum: '$coinsEarned' }, taps: { $sum: '$tapCount' } } },
      { $sort: { _id: 1 } },
    ]),
    WithdrawalRequest.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, coins: { $sum: '$coinsRequested' } } },
      { $sort: { _id: 1 } },
    ]),
    TapSession.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, sessions: { $sum: 1 }, avgScore: { $avg: '$suspicionScore' } } },
      { $sort: { _id: 1 } },
    ]),
  ])

  return { userGrowth, coinsEarned, withdrawalTrend, tapActivity, days }
}

// ─────────────────────────────────────────────────────────────
// TASK MANAGER
// ─────────────────────────────────────────────────────────────
export const getTasks = async ({ page = 1, limit = 20, isActive } = {}) => {
  const filter = {}
  if (isActive !== undefined) filter.isActive = isActive === 'true'
  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Task.countDocuments(filter),
  ])
  return { tasks, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export const createTask = async (adminId, taskData) => {
  const task = await Task.create({ ...taskData, createdBy: adminId })
  await AdminLog.create({ adminId, action: 'create_task', details: { taskId: task._id, title: task.title } })
  return task
}

export const updateTask = async (adminId, taskId, updates) => {
  const task = await Task.findByIdAndUpdate(taskId, { $set: updates }, { new: true })
  if (!task) { const err = new Error('Task not found'); err.code = 'NOT_FOUND'; throw err }
  await AdminLog.create({ adminId, action: 'update_task', details: { taskId, updates } })
  return task
}

export const deleteTask = async (adminId, taskId) => {
  const task = await Task.findByIdAndDelete(taskId)
  if (!task) { const err = new Error('Task not found'); err.code = 'NOT_FOUND'; throw err }
  await AdminLog.create({ adminId, action: 'delete_task', details: { taskId, title: task.title } })
  return { message: `Task "${task.title}" deleted.` }
}

// ─────────────────────────────────────────────────────────────
// ADMIN LOG HISTORY
// ─────────────────────────────────────────────────────────────
export const getAdminLogs = async ({ page = 1, limit = 50 } = {}) => {
  const [logs, total] = await Promise.all([
    AdminLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('adminId', 'username').lean(),
    AdminLog.countDocuments(),
  ])
  return { logs, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}
