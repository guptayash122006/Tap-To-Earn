import { Transaction } from '../models/index.js'
import ApiResponse from '../utils/apiResponse.js'
import asyncHandler from '../utils/asyncHandler.js'

// ─────────────────────────────────────────────────────────────
// GET /api/transactions
// ─────────────────────────────────────────────────────────────
export const getMyTransactions = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const page = Math.max(1, parseInt(req.query.page || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)))
  const type = req.query.type

  const query = { userId }
  if (type) query.type = type

  const total = await Transaction.countDocuments(query)
  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  return ApiResponse.success(res, 200, 'Transactions retrieved successfully.', {
    transactions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  })
})
