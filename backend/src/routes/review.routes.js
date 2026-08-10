const { Router } = require('express');
const controller = require('../controllers/review.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const Role = require('../constants/roles');
const { uploadMultiple } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { createReviewSchema, updateReviewSchema, ownerReplySchema } = require('../validations/review.validation');

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/field/:fieldId', controller.getFieldReviews);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.use(authenticate);

router.get('/me', controller.getMyReviews);
router.get('/owner/reviews', authorize(Role.FIELD_OWNER, Role.ADMIN), controller.getOwnerReviews);
router.post('/',
  uploadLimiter, uploadMultiple('images', 4), validate(createReviewSchema),
  controller.createReview
);
router.patch('/:id', validate(updateReviewSchema), controller.updateReview);
router.delete('/:id', controller.deleteReview);
router.post('/:id/like', controller.toggleLike);
router.post('/:id/reply', validate(ownerReplySchema), controller.ownerReply);

module.exports = router;
