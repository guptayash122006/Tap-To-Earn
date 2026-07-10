import { body, param } from 'express-validator'
import { WITHDRAWAL }  from '../config/constants.js'

// ─────────────────────────────────────────────────────────────
// PAYMENT DETAIL VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────
const upiIdRegex    = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/
const ifscRegex     = /^[A-Z]{4}0[A-Z0-9]{6}$/
const cryptoRegex   = /^[a-zA-Z0-9]{20,100}$/

const validatePaymentDetails = (method, details = {}) => {
  if (!details || typeof details !== 'object') return 'paymentDetails is required.'

  switch (method) {
    case 'upi':
      if (!details.upiId || !upiIdRegex.test(details.upiId)) return 'Valid UPI ID is required (e.g. name@bank).'
      break
    case 'paypal':
      if (!details.paypalEmail || !/\S+@\S+\.\S+/.test(details.paypalEmail)) return 'Valid PayPal email is required.'
      break
    case 'bank_transfer':
      if (!details.accountNumber)      return 'Bank account number is required.'
      if (!details.ifscCode || !ifscRegex.test(details.ifscCode.toUpperCase()))
        return 'Valid IFSC code is required (e.g. SBIN0001234).'
      if (!details.accountHolderName)  return 'Account holder name is required.'
      if (!details.bankName)           return 'Bank name is required.'
      break
    case 'crypto':
      if (!details.walletAddress || !cryptoRegex.test(details.walletAddress))
        return 'Valid crypto wallet address is required (20–100 alphanumeric characters).'
      if (!details.cryptoCurrency)     return 'Crypto currency type is required (e.g. BTC, ETH, USDT).'
      break
    case 'gift_card':
      if (!details.giftCardType)       return 'Gift card type is required (e.g. Amazon, Google Play).'
      break
    default:
      return 'Unsupported payment method.'
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// POST /api/withdrawal — Submit Request
// ─────────────────────────────────────────────────────────────
export const submitWithdrawalValidator = [
  body('coinsRequested')
    .notEmpty().withMessage('Withdrawal amount is required.')
    .isInt({ min: WITHDRAWAL.MINIMUM_COINS })
    .withMessage(`Minimum withdrawal is ${WITHDRAWAL.MINIMUM_COINS.toLocaleString()} coins.`),

  body('paymentMethod')
    .notEmpty().withMessage('Payment method is required.')
    .isIn(['upi', 'paypal', 'bank_transfer', 'crypto', 'gift_card'])
    .withMessage('Invalid payment method. Choose: upi, paypal, bank_transfer, crypto, gift_card.'),

  body('paymentDetails')
    .notEmpty().withMessage('Payment details are required.')
    .isObject().withMessage('paymentDetails must be an object.')
    .custom((value, { req }) => {
      const error = validatePaymentDetails(req.body.paymentMethod, value)
      if (error) throw new Error(error)
      return true
    }),
]

// ─────────────────────────────────────────────────────────────
// DELETE /api/withdrawal/:id/cancel — Cancel
// ─────────────────────────────────────────────────────────────
export const cancelWithdrawalValidator = [
  param('id')
    .isMongoId().withMessage('Invalid withdrawal ID.'),
]

// ─────────────────────────────────────────────────────────────
// ADMIN APPROVE / REJECT
// ─────────────────────────────────────────────────────────────
export const adminApproveValidator = [
  param('id').isMongoId().withMessage('Invalid withdrawal ID.'),
  body('txnRef').optional().isString().isLength({ max: 200 }).withMessage('Transaction ref too long.'),
  body('note').optional().isString().isLength({ max: 500 }).withMessage('Note too long.'),
]

export const adminRejectValidator = [
  param('id').isMongoId().withMessage('Invalid withdrawal ID.'),
  body('reason')
    .notEmpty().withMessage('Rejection reason is required.')
    .isString().isLength({ min: 5, max: 500 }).withMessage('Reason must be 5–500 characters.'),
]
