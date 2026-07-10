import { body } from 'express-validator'

export const authValidator = {
  /**
   * POST /api/auth/register
   */
  register: [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required.')
      .isLength({ min: 3, max: 20 }).withMessage('Username must be 3–20 characters.')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores.'),

    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Please enter a valid email address.')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required.')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain at least one number.')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character.'),

    body('confirmPassword')
      .notEmpty().withMessage('Please confirm your password.')
      .custom((value, { req }) => {
        if (value !== req.body.password) throw new Error('Passwords do not match.')
        return true
      }),

    body('referralCode')
      .optional()
      .trim()
      .isLength({ min: 6, max: 12 }).withMessage('Invalid referral code format.')
      .isAlphanumeric().withMessage('Referral code must be alphanumeric.'),
  ],

  /**
   * POST /api/auth/login
   */
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Please enter a valid email address.')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required.'),
  ],

  /**
   * POST /api/auth/refresh
   * (no body validation — token comes from HttpOnly cookie)
   */
  refresh: [],

  /**
   * POST /api/auth/change-password
   */
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required.'),

    body('newPassword')
      .notEmpty().withMessage('New password is required.')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter.')
      .matches(/[0-9]/).withMessage('New password must contain at least one number.')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('New password must contain at least one special character.')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) throw new Error('New password must differ from current password.')
        return true
      }),

    body('confirmNewPassword')
      .notEmpty().withMessage('Please confirm your new password.')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) throw new Error('Passwords do not match.')
        return true
      }),
  ],

  /**
   * POST /api/auth/forgot-password
   */
  forgotPassword: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Please enter a valid email address.')
      .normalizeEmail(),
  ],
}

export default authValidator
