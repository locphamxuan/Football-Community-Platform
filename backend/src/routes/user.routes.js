const { Router } = require('express');
const controller = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const {
  updateProfileSchema, updateNotificationsSchema, changePasswordSchema, pushTokenSchema,
} = require('../validations/user.validation');

const router = Router();
router.use(authenticate);

// ── Current user ─────────────────────────────────────────────────────────────
router.get('/me',            controller.getMe);
router.patch('/me',          validate(updateProfileSchema), controller.updateProfile);
router.patch('/me/password', validate(changePasswordSchema), controller.changePassword);
router.patch('/me/avatar',   uploadLimiter, uploadSingle, controller.updateAvatar);

// ── Thông báo ────────────────────────────────────────────────────────────────
router.patch('/me/notifications', validate(updateNotificationsSchema), controller.updateNotificationPrefs);
router.post('/me/push-tokens',   validate(pushTokenSchema), controller.addPushToken);
router.delete('/me/push-tokens', validate(pushTokenSchema), controller.removePushToken);

// ── Public profile (authenticated) ───────────────────────────────────────────
// Quản trị người dùng nằm ở /admin/users — giữ một đầu mối duy nhất cho thao tác admin
router.get('/:id',           controller.getUserById);

module.exports = router;
