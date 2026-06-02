const { sendError } = require('../utils/ApiResponse');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

/**
 * @param {...string} roles - Các role được phép truy cập
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }
  const hasRole = roles.some((r) => req.user.roles.includes(r));
  if (!hasRole) {
    return sendError(res, 'You do not have permission to perform this action', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
  return next();
};

module.exports = authorize;
