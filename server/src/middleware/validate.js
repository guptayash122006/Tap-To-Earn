import { validationResult } from 'express-validator'
import ApiResponse from '../utils/apiResponse.js'

/**
 * validate — runs express-validator checks and short-circuits
 * the request with 422 Unprocessable Entity if any errors exist.
 *
 * Usage:
 *   router.post('/register', authValidator.register, validate, authController.register)
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field:   e.path || e.param,
      message: e.msg,
    }))
    return ApiResponse.error(res, 422, 'Validation failed.', formatted)
  }
  next()
}

export default validate
