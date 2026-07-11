import express    from 'express'
import protect    from '../middleware/authMiddleware.js'
import adminOnly  from '../middleware/adminMiddleware.js'
import {
  dashboard, listUsers, getUser, banUserCtrl, unbanUserCtrl, adjustCoins,
  listTransactions, referralStats, analytics,
  listTasks, createTaskCtrl, updateTaskCtrl, deleteTaskCtrl,
  adminLogs,
} from '../controllers/adminController.js'
import {
  adminApprove, adminReject, adminProcess, adminQueue,
} from '../controllers/withdrawalController.js'

const router  = express.Router()
const guard   = [protect, adminOnly]  // all admin routes require auth + admin role

// ── Health / Overview ──────────────────────────────────────────
router.get('/dashboard',    ...guard, dashboard)
router.get('/analytics',    ...guard, analytics)
router.get('/logs',         ...guard, adminLogs)

// ── User Management ────────────────────────────────────────────
router.get('/users',                ...guard, listUsers)
router.get('/users/:id',            ...guard, getUser)
router.patch('/users/:id/ban',      ...guard, banUserCtrl)
router.patch('/users/:id/unban',    ...guard, unbanUserCtrl)
router.patch('/users/:id/coins',    ...guard, adjustCoins)

// ── Withdrawals ────────────────────────────────────────────────
router.get('/withdrawals',                     ...guard, adminQueue)
router.patch('/withdrawals/:id/approve',       ...guard, adminApprove)
router.patch('/withdrawals/:id/reject',        ...guard, adminReject)
router.patch('/withdrawals/:id/processing',    ...guard, adminProcess)

// ── Transactions ───────────────────────────────────────────────
router.get('/transactions', ...guard, listTransactions)

// ── Referrals ──────────────────────────────────────────────────
router.get('/referrals',    ...guard, referralStats)

// ── Task Manager ───────────────────────────────────────────────
router.get('/tasks',        ...guard, listTasks)
router.post('/tasks',       ...guard, createTaskCtrl)
router.patch('/tasks/:id',  ...guard, updateTaskCtrl)
router.delete('/tasks/:id', ...guard, deleteTaskCtrl)

export default router
