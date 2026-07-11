import asyncHandler from '../utils/asyncHandler.js'
import ApiResponse  from '../utils/apiResponse.js'
import {
  getDashboardStats, getUsers, getUserById,
  banUser, unbanUser, adjustUserCoins,
  getAllTransactions, getReferralAdminStats,
  getAnalytics, getTasks, createTask, updateTask, deleteTask,
  getAdminLogs,
} from '../services/adminService.js'
import { param, body } from 'express-validator'
import validate from '../middleware/validate.js'

// ── Dashboard ─────────────────────────────────────────────────
export const dashboard    = asyncHandler(async (req, res) => {
  const stats = await getDashboardStats()
  return ApiResponse.success(res, 200, 'Dashboard stats retrieved.', stats)
})

// ── Users ─────────────────────────────────────────────────────
export const listUsers    = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status, role, sort } = req.query
  const result = await getUsers({ page: +page, limit: +limit, search, status, role, sort })
  return ApiResponse.success(res, 200, 'Users retrieved.', result)
})

export const getUser      = asyncHandler(async (req, res) => {
  const data = await getUserById(req.params.id)
  return ApiResponse.success(res, 200, 'User retrieved.', data)
})

export const banUserCtrl  = asyncHandler(async (req, res) => {
  const { reason = 'Policy violation' } = req.body
  const result = await banUser(req.params.id, req.user._id, reason)
  return ApiResponse.success(res, 200, result.message)
})

export const unbanUserCtrl = asyncHandler(async (req, res) => {
  const result = await unbanUser(req.params.id, req.user._id)
  return ApiResponse.success(res, 200, result.message)
})

export const adjustCoins  = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body
  if (!amount || !reason) return ApiResponse.error(res, 400, 'amount and reason are required.')
  const result = await adjustUserCoins(req.params.id, req.user._id, parseInt(amount), reason)
  return ApiResponse.success(res, 200, result.message)
})

// ── Transactions ──────────────────────────────────────────────
export const listTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, type, category, userId } = req.query
  const result = await getAllTransactions({ page: +page, limit: +limit, type, category, userId })
  return ApiResponse.success(res, 200, 'Transactions retrieved.', result)
})

// ── Referrals ─────────────────────────────────────────────────
export const referralStats = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query
  const result = await getReferralAdminStats({ page: +page, limit: +limit })
  return ApiResponse.success(res, 200, 'Referral stats retrieved.', result)
})

// ── Analytics ─────────────────────────────────────────────────
export const analytics    = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days || '7')))
  const result = await getAnalytics(days)
  return ApiResponse.success(res, 200, 'Analytics retrieved.', result)
})

// ── Tasks ─────────────────────────────────────────────────────
export const listTasks    = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isActive } = req.query
  const result = await getTasks({ page: +page, limit: +limit, isActive })
  return ApiResponse.success(res, 200, 'Tasks retrieved.', result)
})

export const createTaskCtrl = asyncHandler(async (req, res) => {
  const task = await createTask(req.user._id, req.body)
  return ApiResponse.success(res, 201, 'Task created.', task)
})

export const updateTaskCtrl = asyncHandler(async (req, res) => {
  const task = await updateTask(req.user._id, req.params.id, req.body)
  return ApiResponse.success(res, 200, 'Task updated.', task)
})

export const deleteTaskCtrl = asyncHandler(async (req, res) => {
  const result = await deleteTask(req.user._id, req.params.id)
  return ApiResponse.success(res, 200, result.message)
})

// ── Admin Logs ────────────────────────────────────────────────
export const adminLogs    = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query
  const result = await getAdminLogs({ page: +page, limit: +limit })
  return ApiResponse.success(res, 200, 'Admin logs retrieved.', result)
})
