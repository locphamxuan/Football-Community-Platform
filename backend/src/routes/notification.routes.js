const { Router } = require('express');
const controller = require('../controllers/notification.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { notificationQuerySchema } = require('../validations/notification.validation');

const router = Router();
router.use(authenticate);

// Hộp thư là của riêng từng người, không phân vai trò: mọi user đăng nhập đều có.
router.get('/', validate(notificationQuerySchema, 'query'), controller.getMyNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', controller.markAsRead);

module.exports = router;
