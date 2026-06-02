const { verifyAccessToken } = require('../utils/jwt');
const { cache, CacheKeys } = require('../config/redis');
const { sendError } = require('../utils/ApiResponse');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);

    // Kiểm tra token bị blacklist (đã logout)
    const isBlacklisted = await cache.exists(CacheKeys.blacklistedToken(payload.jti));
    if (isBlacklisted) {
      return sendError(res, 'Token has been revoked', HttpStatus.UNAUTHORIZED, ErrorCode.TOKEN_INVALID);
    }

    req.user = { id: payload.sub, email: payload.email, roles: payload.roles };
    return next();
  } catch {
    return sendError(res, 'Invalid or expired token', HttpStatus.UNAUTHORIZED, ErrorCode.TOKEN_INVALID);
  }
};

module.exports = authenticate;
