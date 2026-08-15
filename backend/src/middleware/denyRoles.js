const { sendError } = require('../utils/ApiResponse');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

/**
 * Chặn đúng những role được liệt kê, cho phần còn lại đi qua.
 *
 * Ngược với `authorize(...)`, và cần thiết vì mọi tài khoản đều mang role `user` — kể cả
 * quản trị viên. Muốn nói "ai cũng được, trừ admin" bằng `authorize` thì phải liệt kê hết
 * các role còn lại, và mỗi role mới thêm sau này lại lặng lẽ bị khoá ngoài.
 *
 * @param {...string} roles - Các role không được phép truy cập
 */
const denyRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }
  if (roles.some((role) => req.user.roles.includes(role))) {
    return sendError(res, 'This area is not available for your account', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
  return next();
};

module.exports = denyRoles;
