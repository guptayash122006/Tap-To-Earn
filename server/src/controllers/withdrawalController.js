import asyncHandler from '../utils/asyncHandler.js'
import ApiResponse  from '../utils/apiResponse.js'
import {
  submitWithdrawal,
  cancelWithdrawal,
  getMyWithdrawals,
  getWithdrawalSummary,
  adminGetWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminMarkProcessing,
} from '../services/withdrawalService.js'

// ─────────────────────────────────────────────────────────────
// USER — POST /api/withdrawal
// ─────────────────────────────────────────────────────────────
export const createWithdrawal = asyncHandler(async (req, res) => {
  const {
    coinsRequested,
    paymentMethod,
    paymentDetails,
  } = req.body

  const result = await submitWithdrawal(req.user._id, {
    coinsRequested: parseInt(coinsRequested, 10),
    paymentMethod,
    paymentDetails,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent:  req.headers['user-agent'] || null,
  })

  return ApiResponse.success(res, 201, result.message, result)
})

// ─────────────────────────────────────────────────────────────
// USER — DELETE /api/withdrawal/:id/cancel
// ─────────────────────────────────────────────────────────────
export const cancelUserWithdrawal = asyncHandler(async (req, res) => {
  const result = await cancelWithdrawal(req.user._id, req.params.id)
  return ApiResponse.success(res, 200, result.message)
})

// ─────────────────────────────────────────────────────────────
// USER — GET /api/withdrawal/history
// ─────────────────────────────────────────────────────────────
export const getHistory = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1', 10))
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)))
  const status = req.query.status || undefined

  const result = await getMyWithdrawals(req.user._id, { page, limit, status })
  return ApiResponse.success(res, 200, 'Withdrawal history retrieved.', result)
})

// ─────────────────────────────────────────────────────────────
// USER — GET /api/withdrawal/summary
// ─────────────────────────────────────────────────────────────
export const getSummary = asyncHandler(async (req, res) => {
  const summary = await getWithdrawalSummary(req.user._id)
  return ApiResponse.success(res, 200, 'Wallet summary retrieved.', summary)
})

// ─────────────────────────────────────────────────────────────
// ADMIN — GET /api/withdrawal/admin/queue
// ─────────────────────────────────────────────────────────────
export const adminQueue = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1', 10))
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)))
  const status = req.query.status || 'pending'
  const userId = req.query.userId || undefined

  const result = await adminGetWithdrawals({ page, limit, status, userId })
  return ApiResponse.success(res, 200, 'Admin withdrawal queue retrieved.', result)
})

// ─────────────────────────────────────────────────────────────
// ADMIN — PATCH /api/withdrawal/admin/:id/approve
// ─────────────────────────────────────────────────────────────
export const adminApprove = asyncHandler(async (req, res) => {
  const { txnRef, note } = req.body
  const result = await adminApproveWithdrawal(req.params.id, req.user._id, { txnRef, note })
  return ApiResponse.success(res, 200, result.message)
})

// ─────────────────────────────────────────────────────────────
// ADMIN — PATCH /api/withdrawal/admin/:id/reject
// ─────────────────────────────────────────────────────────────
export const adminReject = asyncHandler(async (req, res) => {
  const { reason } = req.body
  if (!reason || !reason.trim()) {
    return ApiResponse.error(res, 400, 'Rejection reason is required.')
  }
  const result = await adminRejectWithdrawal(req.params.id, req.user._id, { reason })
  return ApiResponse.success(res, 200, result.message)
})

// ─────────────────────────────────────────────────────────────
// ADMIN — PATCH /api/withdrawal/admin/:id/processing
// ─────────────────────────────────────────────────────────────
export const adminProcess = asyncHandler(async (req, res) => {
  const result = await adminMarkProcessing(req.params.id, req.user._id, req.body.note)
  return ApiResponse.success(res, 200, result.message)
})
