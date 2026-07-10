/**
 * Standardised API response helpers.
 * Usage:
 *   return ApiResponse.success(res, 200, 'Login successful', { token })
 *   return ApiResponse.error(res, 400, 'Validation failed', errors)
 */
export class ApiResponse {
  static success(res, statusCode = 200, message = 'Success', data = null, meta = null) {
    const payload = { success: true, message }
    if (data !== null) payload.data = data
    if (meta !== null) payload.meta = meta
    return res.status(statusCode).json(payload)
  }

  static error(res, statusCode = 500, message = 'Internal Server Error', errors = null) {
    const payload = { success: false, message }
    if (errors !== null) payload.errors = errors
    return res.status(statusCode).json(payload)
  }

  static paginated(res, message, data, { page, limit, total }) {
    return res.status(200).json({
      success: true,
      message,
      data,
      meta: {
        page:       parseInt(page, 10),
        limit:      parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext:    page * limit < total,
        hasPrev:    page > 1,
      },
    })
  }
}

export default ApiResponse
