import { body } from 'express-validator'
import { TAP } from '../config/constants.js'

export const tapValidator = {
  /**
   * POST /api/tap
   * Validates a tap batch submission.
   */
  registerTap: [
    body('tapCount')
      .notEmpty().withMessage('tapCount is required.')
      .isInt({ min: 1, max: TAP.MAX_PER_BATCH })
      .withMessage(`tapCount must be between 1 and ${TAP.MAX_PER_BATCH}.`),

    body('sessionId')
      .notEmpty().withMessage('sessionId is required.')
      .isString()
      .isLength({ min: 8, max: 64 })
      .withMessage('sessionId must be 8–64 characters.')
      .matches(/^[a-zA-Z0-9_\-]+$/)
      .withMessage('sessionId contains invalid characters.'),

    body('clientTimestamp')
      .notEmpty().withMessage('clientTimestamp is required.')
      .isISO8601().withMessage('clientTimestamp must be a valid ISO 8601 date.'),

    body('tapIntervals')
      .optional()
      .isArray({ max: TAP.MAX_PER_BATCH })
      .withMessage(`tapIntervals must be an array of at most ${TAP.MAX_PER_BATCH} items.`),

    body('tapIntervals.*')
      .optional()
      .isFloat({ min: 0, max: 60000 })
      .withMessage('Each tap interval must be between 0 and 60,000 ms.'),

    body('energyAtClient')
      .optional()
      .isInt({ min: 0, max: 1000 })
      .withMessage('energyAtClient must be an integer 0–1000.'),
  ],
}

export default tapValidator
