const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { hashPassword, comparePassword, hashToken, compareToken } = require('../utils/bcrypt');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken, getTokenExpiry } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { cache, CacheKeys } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');
const env = require('../config/env');

// ─── Register ────────────────────────────────────────────────────────────────
const register = async ({ email, password, username, fullName, phone }) => {
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing?.email === email) {
    throw new AppError('Email already in use', HttpStatus.CONFLICT, ErrorCode.EMAIL_ALREADY_EXISTS);
  }
  if (existing?.username === username) {
    throw new AppError('Username already taken', HttpStatus.CONFLICT, ErrorCode.USERNAME_ALREADY_EXISTS);
  }

  const hashedPwd = await hashPassword(password);
  const verifyToken = uuidv4();
  const tokenHash = await hashToken(verifyToken);

  await User.create({
    email,
    password: hashedPwd,
    username,
    fullName,
    phone,
    emailVerificationToken: tokenHash,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendVerificationEmail(email, verifyToken);
  return { message: 'Registration successful. Please check your email to verify your account.' };
};

// ─── Login ───────────────────────────────────────────────────────────────────
const login = async ({ email, password }, deviceInfo, ipAddress) => {
  const user = await User.findOne({ email }).select('+password +refreshTokens +emailVerified');
  if (!user || !(await comparePassword(password, user.password))) {
    throw new AppError('Invalid email or password', HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
  }
  if (!user.emailVerified) {
    throw new AppError('Please verify your email before logging in', HttpStatus.FORBIDDEN, ErrorCode.EMAIL_NOT_VERIFIED);
  }
  if (user.status === 'banned') {
    throw new AppError('Your account has been suspended', HttpStatus.FORBIDDEN, ErrorCode.ACCOUNT_BANNED);
  }

  const { token: accessToken } = generateAccessToken(user._id.toString(), user.email, user.roles);
  const { token: refreshToken } = generateRefreshToken(user._id.toString());
  const tokenHash = await hashToken(refreshToken);

  const validTokens = user.refreshTokens.filter((t) => t.expiresAt > new Date());
  validTokens.push({ tokenHash, deviceInfo, ipAddress, expiresAt: getTokenExpiry(env.JWT_REFRESH_EXPIRES_IN) });

  await User.findByIdAndUpdate(user._id, {
    refreshTokens: validTokens.slice(-5),
    lastSeen: new Date(),
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      roles: user.roles,
    },
  };
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refreshToken = async (token, deviceInfo, ipAddress) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid refresh token', HttpStatus.UNAUTHORIZED, ErrorCode.REFRESH_TOKEN_INVALID);
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user) throw new AppError('User not found', HttpStatus.UNAUTHORIZED, ErrorCode.REFRESH_TOKEN_INVALID);

  let matchedIdx = -1;
  for (let i = 0; i < user.refreshTokens.length; i++) {
    const t = user.refreshTokens[i];
    if (t.expiresAt > new Date() && (await compareToken(token, t.tokenHash))) {
      matchedIdx = i;
      break;
    }
  }

  if (matchedIdx === -1) {
    await User.findByIdAndUpdate(user._id, { refreshTokens: [] });
    throw new AppError('Token reuse detected. Please login again.', HttpStatus.UNAUTHORIZED, ErrorCode.REFRESH_TOKEN_INVALID);
  }

  const { token: newAccess } = generateAccessToken(user._id.toString(), user.email, user.roles);
  const { token: newRefresh } = generateRefreshToken(user._id.toString());
  const newHash = await hashToken(newRefresh);

  user.refreshTokens[matchedIdx] = { tokenHash: newHash, deviceInfo, ipAddress, expiresAt: getTokenExpiry(env.JWT_REFRESH_EXPIRES_IN) };
  await User.findByIdAndUpdate(user._id, { refreshTokens: user.refreshTokens });

  return { accessToken: newAccess, refreshToken: newRefresh };
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (userId, accessToken) => {
  try {
    const payload = verifyAccessToken(accessToken);
    // Giữ vé thu hồi đúng bằng tuổi còn lại của chính token này. TTL cứng sẽ sai ngay
    // khi JWT_ACCESS_EXPIRES_IN được đổi, và token đã đăng xuất sống lại từ lúc vé hết
    // hạn cho tới lúc token hết hạn. `verifyAccessToken` đã loại token quá hạn, nên
    // sàn 1 giây chỉ để chặn `setex 0` khi đồng hồ lệch đúng vào giây cuối.
    const secondsLeft = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
    await cache.set(CacheKeys.blacklistedToken(payload.jti), '1', secondsLeft);
  } catch { /* token đã invalid, bỏ qua */ }

  await User.findByIdAndUpdate(userId, { refreshTokens: [] });
};

// ─── Verify Email ──────────────────────────────────────────────────────────────
const verifyEmail = async (token) => {
  const users = await User.find({ emailVerificationExpires: { $gt: new Date() } })
    .select('+emailVerificationToken +emailVerificationExpires');

  let target = null;
  for (const u of users) {
    if (u.emailVerificationToken && (await compareToken(token, u.emailVerificationToken))) {
      target = u;
      break;
    }
  }

  if (!target) throw new AppError('Invalid or expired verification token', HttpStatus.BAD_REQUEST, ErrorCode.TOKEN_INVALID);

  await User.findByIdAndUpdate(target._id, {
    emailVerified: true,
    $unset: { emailVerificationToken: '', emailVerificationExpires: '' },
  });

  return { message: 'Email verified successfully. You can now log in.' };
};

// ─── Resend Verification ───────────────────────────────────────────────────────
const resendVerification = async (email) => {
  const msg = { message: 'If that email is registered, a verification link has been sent.' };
  const user = await User.findOne({ email }).select('+emailVerified');
  if (!user) return msg;
  if (user.emailVerified) throw new AppError('Email is already verified', HttpStatus.CONFLICT, ErrorCode.CONFLICT);

  const token = uuidv4();
  await User.findByIdAndUpdate(user._id, {
    emailVerificationToken: await hashToken(token),
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await sendVerificationEmail(email, token);
  return msg;
};

// ─── Forgot Password ───────────────────────────────────────────────────────────
const forgotPassword = async (email) => {
  const msg = { message: 'If that email is registered, a password reset link has been sent.' };
  const user = await User.findOne({ email });
  if (!user) return msg;

  const resetToken = crypto.randomBytes(32).toString('hex');
  await User.findByIdAndUpdate(user._id, {
    resetPasswordToken: await hashToken(resetToken),
    resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
  });
  await sendPasswordResetEmail(email, resetToken);
  return msg;
};

// ─── Reset Password ────────────────────────────────────────────────────────────
const resetPassword = async (token, newPassword) => {
  const users = await User.find({ resetPasswordExpires: { $gt: new Date() } })
    .select('+resetPasswordToken +resetPasswordExpires');

  let target = null;
  for (const u of users) {
    if (u.resetPasswordToken && (await compareToken(token, u.resetPasswordToken))) {
      target = u;
      break;
    }
  }

  if (!target) throw new AppError('Invalid or expired reset token', HttpStatus.BAD_REQUEST, ErrorCode.RESET_TOKEN_INVALID);

  await User.findByIdAndUpdate(target._id, {
    password: await hashPassword(newPassword),
    refreshTokens: [],
    $unset: { resetPasswordToken: '', resetPasswordExpires: '' },
  });

  return { message: 'Password reset successful. Please log in with your new password.' };
};

module.exports = { register, login, refreshToken, logout, verifyEmail, resendVerification, forgotPassword, resetPassword };
