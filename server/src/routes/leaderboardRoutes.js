import express from 'express'
import protect from '../middleware/authMiddleware.js'
import { getLeaderboardCtrl } from '../controllers/leaderboardController.js'

const router = express.Router()

/**
 * @route  GET /api/leaderboard
 * @desc   Get top ranks plus logged-in user standing
 * @access Private
 */
router.get('/', protect, getLeaderboardCtrl)

export default router
