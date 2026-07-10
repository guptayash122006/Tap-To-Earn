/**
 * Pagination helper — extracts and validates page/limit from req.query.
 *
 * Usage:
 *   const { page, limit, skip } = getPagination(req.query)
 *   const docs = await Model.find().skip(skip).limit(limit)
 */
export const getPagination = (query = {}, defaults = { page: 1, limit: 20, maxLimit: 100 }) => {
  let page  = parseInt(query.page, 10)  || defaults.page
  let limit = parseInt(query.limit, 10) || defaults.limit

  if (page  < 1) page  = 1
  if (limit < 1) limit = 1
  if (limit > defaults.maxLimit) limit = defaults.maxLimit

  const skip = (page - 1) * limit

  return { page, limit, skip }
}

export default getPagination
