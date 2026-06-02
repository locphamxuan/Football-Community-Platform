/**
 * Gửi response thành công chuẩn hoá.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} message
 * @param {number} statusCode
 * @param {object} meta  - pagination hoặc thông tin bổ sung
 */
const sendSuccess = (res, data, message = 'Success', statusCode = 200, meta = null) => {
  const response = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

/**
 * Gửi response lỗi chuẩn hoá.
 */
const sendError = (res, message, statusCode = 500, code = 'INTERNAL_ERROR', errors = null) => {
  const response = { success: false, message, code };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

/**
 * Tạo pagination meta.
 */
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

module.exports = { sendSuccess, sendError, paginationMeta };
