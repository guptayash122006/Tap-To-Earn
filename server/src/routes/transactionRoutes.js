import express from 'express'
import protect from '../middleware/authMiddleware.js'
import { getMyTransactions } from '../controllers/transactionController.js'

const router = express.Router()

/**
 * @route  GET /api/transactions
 * @desc   Get user's ledger transaction history (paginated)
 * @access Private
 */
router.get('/', protect, getMyTransactions)

export default router
