const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');
const { parseExpiry } = require('../utils/jwt');
const env = require('../config/env');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: parseExpiry(env.JWT_ACCESS_EXPIRES_IN),
  path: '/api/v1',
};

/**
 * Web giữ cả access lẫn refresh token trong cookie `httpOnly` — JS trên trang không đọc được
 * nên bị XSS cũng không lấy được token ra khỏi trình duyệt. App di động không có cookie jar
 * đáng tin cậy để dựa vào, nhưng lại có Keychain / Keystore — chỗ cất tương đương. Nên khi
 * client tự khai là mobile thì trả token trong body để nó tự cất; cookie vẫn set song song
 * cho web, không phía nào bị hạ mức bảo vệ vì phía kia.
 */
const wantsTokenInBody = (req) => req.headers['x-client'] === 'mobile';

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
};

const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, result, result.message, HttpStatus.CREATED);
});

const login = catchAsync(async (req, res) => {
  const deviceInfo = req.headers['user-agent'] || 'Unknown';
  const ipAddress = req.ip || '';
  const result = await authService.login(req.body, deviceInfo, ipAddress);

  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendSuccess(res, {
    user: result.user,
    ...(wantsTokenInBody(req) ? { accessToken: result.accessToken, refreshToken: result.refreshToken } : {}),
  }, 'Login successful');
});

const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Refresh token required', code: 'REFRESH_TOKEN_INVALID' });
  }
  const deviceInfo = req.headers['user-agent'] || 'Unknown';
  const result = await authService.refreshToken(token, deviceInfo, req.ip || '');

  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendSuccess(res, {
    ...(wantsTokenInBody(req) ? { accessToken: result.accessToken, refreshToken: result.refreshToken } : {}),
  }, 'Token refreshed');
});

const logout = catchAsync(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken || '';
  await authService.logout(req.user.id, token);
  res.clearCookie('accessToken', { path: '/api/v1' });
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  sendSuccess(res, null, 'Logged out successfully');
});

const verifyEmail = catchAsync(async (req, res) => {
  const result = await authService.verifyEmail(req.params.token);
  sendSuccess(res, result, result.message);
});

const resendVerification = catchAsync(async (req, res) => {
  const result = await authService.resendVerification(req.body.email);
  sendSuccess(res, result, result.message);
});

const forgotPassword = catchAsync(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  sendSuccess(res, result, result.message);
});

const resetPassword = catchAsync(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  sendSuccess(res, result, result.message);
});

module.exports = { register, login, refreshToken, logout, verifyEmail, resendVerification, forgotPassword, resetPassword };
