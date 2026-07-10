import mongoose from 'mongoose'
import { User, Coin, Transaction, WithdrawalRequest } from '../models/index.js'
import { WITHDRAWAL, STATUS, ROLES } from '../config/constants.js'

// ─────────────────────────────────────────────────────────────
// SUBMIT WITHDRAWAL REQUEST
// ─────────────────────────────────────────────────────────────
/**
 * submitWithdrawal — validates balance, locks coins, creates request.
 * Coins are moved to pendingWithdrawal immediately (atomically).
 */
export const submitWithdrawal = async (userId, {
  coinsRequested,
  paymentMethod,
  paymentDetails,
  ipAddress = null,
  userAgent  = null,
}) => {
  // ── 1. Minimum check ──────────────────────────────────────
  if (coinsRequested < WITHDRAWAL.MINIMUM_COINS) {
    const err = new Error(`Minimum withdrawal is ${WITHDRAWAL.MINIMUM_COINS.toLocaleString()} coins.`)
    err.code = 'BELOW_MINIMUM'
    throw err
  }

  // ── 2. Load wallet ────────────────────────────────────────
  const wallet = await Coin.findOne({ userId })
  if (!wallet) {
    const err = new Error('Wallet not found. Please tap to initialise your wallet.')
    err.code = 'WALLET_NOT_FOUND'
    throw err
  }

  const withdrawable = Math.max(0, wallet.availableBalance - wallet.lockedBalance)
  if (withdrawable < coinsRequested) {
    const err = new Error(
      `Insufficient balance. Available: ${withdrawable.toLocaleString()} coins.`
    )
    err.code = 'INSUFFICIENT_BALANCE'
    throw err
  }

  // ── 3. No duplicate pending requests ─────────────────────
  const hasPending = await WithdrawalRequest.exists({
    userId,
    status: { $in: ['pending', 'processing'] },
  })
  if (hasPending) {
    const err = new Error('You already have a pending withdrawal request. Please wait for it to be processed.')
    err.code = 'PENDING_EXISTS'
    throw err
  }

  // ── 4. Atomic: lock coins + create withdrawal + create txn ─
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const fiatAmount   = parseFloat((coinsRequested * WITHDRAWAL.CONVERSION_RATE).toFixed(4))
    const balanceBefore = wallet.availableBalance

    // 4a. Lock coins in pendingWithdrawal, reduce availableBalance
    const updatedWallet = await Coin.findOneAndUpdate(
      { userId, availableBalance: { $gte: coinsRequested } },
      {
        $inc: {
          availableBalance:  -coinsRequested,
          pendingWithdrawal:  coinsRequested,
          totalSpent:         coinsRequested,
        },
      },
      { new: true, session }
    )

    if (!updatedWallet) {
      const err = new Error('Insufficient balance (race condition). Please try again.')
      err.code = 'INSUFFICIENT_BALANCE'
      throw err
    }

    // 4b. Create withdrawal request
    const [withdrawal] = await WithdrawalRequest.create(
      [
        {
          userId,
          coinsRequested,
          conversionRate: WITHDRAWAL.CONVERSION_RATE,
          fiatAmount,
          currency:       WITHDRAWAL.CURRENCY,
          paymentMethod,
          paymentDetails,
          status:         'pending',
          statusHistory:  [{ status: 'pending', changedAt: new Date(), note: 'User submitted' }],
          snapshotCoinsAtRequest: balanceBefore,
          ipAddress,
          userAgent,
        },
      ],
      { session }
    )

    // 4c. Transaction ledger entry (debit)
    const [txn] = await Transaction.create(
      [
        {
          userId,
          type:          'withdrawal_request',
          category:      'debit',
          amount:        coinsRequested,
          balanceBefore,
          balanceAfter:  updatedWallet.availableBalance,
          description:   `Withdrawal request of ${coinsRequested.toLocaleString()} coins via ${paymentMethod}`,
          metadata:      { withdrawalId: withdrawal._id, fiatAmount, currency: WITHDRAWAL.CURRENCY },
        },
      ],
      { session }
    )

    // 4d. Link transaction to withdrawal
    await WithdrawalRequest.findByIdAndUpdate(
      withdrawal._id,
      { transactionId: txn._id },
      { session }
    )

    await session.commitTransaction()

    return {
      withdrawalId:    withdrawal._id,
      coinsRequested,
      fiatAmount,
      currency:        WITHDRAWAL.CURRENCY,
      paymentMethod,
      status:          'pending',
      message:         `Your withdrawal of ${coinsRequested.toLocaleString()} coins ($${fiatAmount} USD) has been submitted and is under review.`,
      processingDays:  WITHDRAWAL.PROCESSING_DAYS,
    }

  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
}

// ─────────────────────────────────────────────────────────────
// CANCEL WITHDRAWAL (by user, only when pending)
// ─────────────────────────────────────────────────────────────
export const cancelWithdrawal = async (userId, withdrawalId) => {
  const withdrawal = await WithdrawalRequest.findOne({ _id: withdrawalId, userId })

  if (!withdrawal) {
    const err = new Error('Withdrawal request not found.'); err.code = 'NOT_FOUND'; throw err
  }
  if (withdrawal.status !== 'pending') {
    const err = new Error(`Cannot cancel a request with status "${withdrawal.status}".`)
    err.code = 'INVALID_STATUS_TRANSITION'; throw err
  }

  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    // Restore locked coins
    await Coin.findOneAndUpdate(
      { userId },
      {
        $inc: {
          availableBalance:  withdrawal.coinsRequested,
          pendingWithdrawal: -withdrawal.coinsRequested,
          totalSpent:        -withdrawal.coinsRequested,
        },
      },
      { session }
    )

    // Mark cancelled
    await WithdrawalRequest.findByIdAndUpdate(
      withdrawalId,
      {
        $set:  { status: 'cancelled', processedAt: new Date() },
        $push: { statusHistory: { status: 'cancelled', changedAt: new Date(), note: 'Cancelled by user' } },
      },
      { session }
    )

    // Reversal transaction
    const wallet = await Coin.findOne({ userId }).session(session)
    await Transaction.create(
      [
        {
          userId,
          type:          'withdrawal_cancelled',
          category:      'credit',
          amount:        withdrawal.coinsRequested,
          balanceBefore: wallet.availableBalance - withdrawal.coinsRequested,
          balanceAfter:  wallet.availableBalance,
          description:   `Withdrawal #${withdrawalId} cancelled — coins restored`,
          metadata:      { withdrawalId },
        },
      ],
      { session }
    )

    await session.commitTransaction()
    return { message: 'Withdrawal request cancelled. Coins have been restored to your balance.' }
  } catch (err) {
    await session.abortTransaction(); throw err
  } finally {
    session.endSession()
  }
}

// ─────────────────────────────────────────────────────────────
// GET MY WITHDRAWAL HISTORY (paginated)
// ─────────────────────────────────────────────────────────────
export const getMyWithdrawals = async (userId, { page = 1, limit = 10, status } = {}) => {
  const skip   = (page - 1) * limit
  const filter = { userId }
  if (status) filter.status = status

  const [withdrawals, total] = await Promise.all([
    WithdrawalRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-statusHistory -ipAddress -userAgent')
      .lean(),
    WithdrawalRequest.countDocuments(filter),
  ])

  const stats = await WithdrawalRequest.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id:             null,
        totalRequested:  { $sum: '$coinsRequested' },
        totalApproved:   { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$coinsRequested', 0] } },
        totalPending:    { $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, '$coinsRequested', 0] } },
        totalRejected:   { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, '$coinsRequested', 0] } },
        count:           { $sum: 1 },
      },
    },
  ])

  return {
    withdrawals,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    stats:      stats[0] || { totalRequested: 0, totalApproved: 0, totalPending: 0, totalRejected: 0, count: 0 },
    minimumWithdrawal: WITHDRAWAL.MINIMUM_COINS,
    conversionRate:    WITHDRAWAL.CONVERSION_RATE,
  }
}

// ─────────────────────────────────────────────────────────────
// GET WALLET SUMMARY (for the withdrawal page header)
// ─────────────────────────────────────────────────────────────
export const getWithdrawalSummary = async (userId) => {
  const wallet = await Coin.findOne({ userId }).lean()
  if (!wallet) {
    return {
      availableBalance: 0, pendingWithdrawal: 0,
      withdrawableBalance: 0, usdValue: 0,
      minimumCoins: WITHDRAWAL.MINIMUM_COINS,
      conversionRate: WITHDRAWAL.CONVERSION_RATE,
      canWithdraw: false,
    }
  }
  const withdrawable = Math.max(0, wallet.availableBalance - wallet.lockedBalance)
  return {
    availableBalance:    wallet.availableBalance,
    pendingWithdrawal:   wallet.pendingWithdrawal,
    lockedBalance:       wallet.lockedBalance,
    withdrawableBalance: withdrawable,
    usdValue:            parseFloat((withdrawable * WITHDRAWAL.CONVERSION_RATE).toFixed(4)),
    minimumCoins:        WITHDRAWAL.MINIMUM_COINS,
    conversionRate:      WITHDRAWAL.CONVERSION_RATE,
    canWithdraw:         withdrawable >= WITHDRAWAL.MINIMUM_COINS,
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: GET ALL WITHDRAWALS (queue)
// ─────────────────────────────────────────────────────────────
export const adminGetWithdrawals = async ({ page = 1, limit = 20, status, userId: filterUserId } = {}) => {
  const skip   = (page - 1) * limit
  const filter = {}
  if (status)       filter.status = status
  if (filterUserId) filter.userId = filterUserId

  const [withdrawals, total, pendingCount, [paidStats]] = await Promise.all([
    WithdrawalRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId',      'username email')
      .populate('processedBy', 'username')
      .lean(),
    WithdrawalRequest.countDocuments(filter),
    WithdrawalRequest.countDocuments({ status: 'pending' }),
    WithdrawalRequest.getTotalPaidOut(),
  ])

  return {
    withdrawals,
    pagination:   { total, page, limit, totalPages: Math.ceil(total / limit) },
    pendingCount,
    totalPaidCoins: paidStats?.totalCoins || 0,
    totalPaidUsd:   paidStats?.totalFiat  || 0,
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: APPROVE WITHDRAWAL
// ─────────────────────────────────────────────────────────────
export const adminApproveWithdrawal = async (withdrawalId, adminId, { txnRef = null, note = null } = {}) => {
  const withdrawal = await WithdrawalRequest.findById(withdrawalId)
  if (!withdrawal) {
    const err = new Error('Withdrawal not found.'); err.code = 'NOT_FOUND'; throw err
  }
  if (!['pending', 'processing'].includes(withdrawal.status)) {
    const err = new Error(`Cannot approve a request with status "${withdrawal.status}".`)
    err.code = 'INVALID_STATUS_TRANSITION'; throw err
  }

  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    // Release pendingWithdrawal (coins already debited from available on submit)
    await Coin.findOneAndUpdate(
      { userId: withdrawal.userId },
      { $inc: { pendingWithdrawal: -withdrawal.coinsRequested } },
      { session }
    )

    await WithdrawalRequest.findByIdAndUpdate(
      withdrawalId,
      {
        $set: {
          status:               'approved',
          processedBy:          adminId,
          processedAt:          new Date(),
          adminNote:            note,
          transactionReference: txnRef,
        },
        $push: {
          statusHistory: {
            status:    'approved',
            changedAt: new Date(),
            changedBy: adminId,
            note:      note || 'Approved by admin',
          },
        },
      },
      { session }
    )

    await session.commitTransaction()
    return { message: `Withdrawal #${withdrawalId} approved successfully.` }
  } catch (err) {
    await session.abortTransaction(); throw err
  } finally {
    session.endSession()
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: REJECT WITHDRAWAL
// ─────────────────────────────────────────────────────────────
export const adminRejectWithdrawal = async (withdrawalId, adminId, { reason } = {}) => {
  const withdrawal = await WithdrawalRequest.findById(withdrawalId)
  if (!withdrawal) {
    const err = new Error('Withdrawal not found.'); err.code = 'NOT_FOUND'; throw err
  }
  if (!['pending', 'processing'].includes(withdrawal.status)) {
    const err = new Error(`Cannot reject a request with status "${withdrawal.status}".`)
    err.code = 'INVALID_STATUS_TRANSITION'; throw err
  }

  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    // Restore coins to user's available balance
    const wallet = await Coin.findOneAndUpdate(
      { userId: withdrawal.userId },
      {
        $inc: {
          availableBalance:  withdrawal.coinsRequested,
          pendingWithdrawal: -withdrawal.coinsRequested,
          totalSpent:        -withdrawal.coinsRequested,
        },
      },
      { new: true, session }
    )

    await WithdrawalRequest.findByIdAndUpdate(
      withdrawalId,
      {
        $set: {
          status:      'rejected',
          processedBy:  adminId,
          processedAt:  new Date(),
          adminNote:    reason || 'Request rejected by admin',
        },
        $push: {
          statusHistory: {
            status:    'rejected',
            changedAt: new Date(),
            changedBy: adminId,
            note:      reason || 'Rejected by admin',
          },
        },
      },
      { session }
    )

    // Reversal transaction
    await Transaction.create(
      [
        {
          userId:        withdrawal.userId,
          type:          'withdrawal_rejected',
          category:      'credit',
          amount:        withdrawal.coinsRequested,
          balanceBefore: wallet.availableBalance - withdrawal.coinsRequested,
          balanceAfter:  wallet.availableBalance,
          description:   `Withdrawal #${withdrawalId} rejected — coins restored. Reason: ${reason || 'N/A'}`,
          metadata:      { withdrawalId, adminId, reason },
        },
      ],
      { session }
    )

    await session.commitTransaction()
    return { message: `Withdrawal #${withdrawalId} rejected. User's coins restored.` }
  } catch (err) {
    await session.abortTransaction(); throw err
  } finally {
    session.endSession()
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: SET STATUS TO PROCESSING
// ─────────────────────────────────────────────────────────────
export const adminMarkProcessing = async (withdrawalId, adminId, note = null) => {
  const withdrawal = await WithdrawalRequest.findById(withdrawalId)
  if (!withdrawal || withdrawal.status !== 'pending') {
    const err = new Error('Withdrawal not found or not in pending state.'); err.code = 'NOT_FOUND'; throw err
  }
  await WithdrawalRequest.findByIdAndUpdate(withdrawalId, {
    $set:  { status: 'processing', processedBy: adminId },
    $push: { statusHistory: { status: 'processing', changedAt: new Date(), changedBy: adminId, note } },
  })
  return { message: `Withdrawal #${withdrawalId} marked as processing.` }
}
