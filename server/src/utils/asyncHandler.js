/**
 * Wraps async route handlers to catch unhandled promise rejections
 * and forward them to Express error middleware — no try/catch needed in controllers.
 *
 * Usage:
 *   router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export default asyncHandler
