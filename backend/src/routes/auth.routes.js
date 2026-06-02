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
router.post('/refresh-token',                                                           controller.refreshToken);
router.get( '/verify-email/:token',                                                     controller.verifyEmail);
router.post('/resend-verification', authLimiter, validate(resendVerificationSchema),   controller.resendVerification);
router.post('/forgot-password',     authLimiter, validate(forgotPasswordSchema),       controller.forgotPassword);
router.post('/reset-password',      authLimiter, validate(resetPasswordSchema),        controller.resetPassword);
router.post('/logout',              authenticate,                                       controller.logout);

module.exports = router;
