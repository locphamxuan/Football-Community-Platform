const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} = require('../validations/auth.validation');

const router = Router();

router.post('/register',            authLimiter, validate(registerSchema),             controller.register);
router.post('/login',               authLimiter, validate(loginSchema),                controller.login);
router.post('/refresh-token',       authLimiter,                                       controller.refreshToken);
// Không JWT nên đếm theo IP; đăng ký cũng qua authLimiter nên không ai xây được một hàng dài
// tài khoản chưa xác thực nhanh hơn giới hạn này — chặn được kiểu DoS "gọi liên tục để ép
// verifyEmail bcrypt-compare qua từng tài khoản đang chờ xác thực" (xem services/auth.service.js).
router.get( '/verify-email/:token', authLimiter,                                       controller.verifyEmail);
router.post('/resend-verification', authLimiter, validate(resendVerificationSchema),   controller.resendVerification);
router.post('/forgot-password',     authLimiter, validate(forgotPasswordSchema),       controller.forgotPassword);
router.post('/reset-password',      authLimiter, validate(resetPasswordSchema),        controller.resetPassword);
router.post('/logout',              authenticate,                                       controller.logout);

module.exports = router;
