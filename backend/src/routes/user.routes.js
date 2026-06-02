const { Router } = require('express');
const controller = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const Role = require('../constants/roles');
const { updateProfileSchema, changePasswordSchema, adminUpdateUserSchema } = require('../validations/user.validation');

const router = Router();
router.use(authenticate);

// ── Current user ─────────────────────────────────────────────────────────────
router.get('/me',            controller.getMe);
router.patch('/me',          validate(updateProfileSchema), controller.updateProfile);
router.patch('/me/password', validate(changePasswordSchema), controller.changePassword);
router.patch('/me/avatar',   uploadLimiter, uploadSingle, controller.updateAvatar);

// ── Public profile (authenticated) ───────────────────────────────────────────
router.get('/:id',           controller.getUserById);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/',              authorize(Role.ADMIN), controller.getUsers);
router.patch('/:id/status',  authorize(Role.ADMIN), validate(adminUpdateUserSchema), controller.updateUserStatus);

module.exports = router;
