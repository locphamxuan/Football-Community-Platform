const { sendError } = require('../utils/ApiResponse');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

/**
 * Giải mã các field được gửi dạng JSON string qua multipart/form-data.
 *
 * multer chỉ trả về text cho mọi field không phải file, nên object/array lồng
 * nhau (location, pricing, amenities...) phải được JSON.parse trước khi đi qua
 * Zod validation — nếu không schema `z.object`/`z.number` sẽ luôn fail.
 *
 * @param {string[]} fields tên các field cần parse
 */
const parseJsonFields = (fields) => (req, res, next) => {
  const errors = {};

  fields.forEach((key) => {
    const raw = req.body?.[key];
    if (typeof raw !== 'string' || raw === '') return;
    try {
      req.body[key] = JSON.parse(raw);
    } catch {
      errors[key] = [`${key} must be a valid JSON string`];
    }
  });

  if (Object.keys(errors).length > 0) {
    return sendError(res, 'Validation failed', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, errors);
  }
  return next();
};

module.exports = parseJsonFields;
