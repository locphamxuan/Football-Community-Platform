const { Router } = require('express');
const controller = require('../controllers/booking.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const Role = require('../constants/roles');
const { createBookingSchema, cancelBookingSchema, ownerBookingsQuerySchema } = require('../validations/booking.validation');

const router = Router();
router.use(authenticate);

// ── Field owner / Admin ───────────────────────────────────────────────────────
// Đặt trước '/:id' để '/owner/...' không bị hiểu là booking id
router.get('/owner/bookings',
  authorize(Role.FIELD_OWNER, Role.ADMIN),
  validate(ownerBookingsQuerySchema, 'query'),
  controller.getOwnerBookings
);
router.get('/owner/stats', authorize(Role.FIELD_OWNER, Role.ADMIN), controller.getOwnerStats);

// ── User ──────────────────────────────────────────────────────────────────────
router.post('/',             validate(createBookingSchema), controller.createBooking);
router.get('/my-bookings',   controller.getMyBookings);
router.get('/:id',           controller.getBookingById);
router.patch('/:id/cancel',  validate(cancelBookingSchema), controller.cancelBooking);

// ── Field owner / Admin ───────────────────────────────────────────────────────
router.get('/field/:fieldId', authorize(Role.FIELD_OWNER, Role.ADMIN), controller.getFieldBookings);
router.patch('/:id/confirm',  authorize(Role.FIELD_OWNER, Role.ADMIN), controller.confirmBooking);
router.patch('/:id/complete', authorize(Role.FIELD_OWNER, Role.ADMIN), controller.completeBooking);
router.patch('/:id/no-show',  authorize(Role.FIELD_OWNER, Role.ADMIN), controller.markNoShow);

module.exports = router;
