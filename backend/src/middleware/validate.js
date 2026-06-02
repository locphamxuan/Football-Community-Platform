const { sendError } = require('../utils/ApiResponse');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

/**
 * Validate request với Zod schema.
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} target
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) {
    const errors = {};
    result.error.issues.forEach((issue) => {
      const path = issue.path.join('.') || 'value';
      if (!errors[path]) errors[path] = [];
      errors[path].push(issue.message);
    });
    return sendError(res, 'Validation failed', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, errors);
  }
  req[target] = result.data;
  return next();
};

module.exports = validate;
