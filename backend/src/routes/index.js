const { Router } = require('express');
const authRoutes         = require('./auth.routes');
const userRoutes         = require('./user.routes');
const fieldRoutes        = require('./field.routes');
const bookingRoutes      = require('./booking.routes');
const teamRoutes         = require('./team.routes');
const matchRequestRoutes = require('./matchRequest.routes');
const reviewRoutes       = require('./review.routes');
const billingRoutes      = require('./billing.routes');
const notificationRoutes = require('./notification.routes');
const adminRoutes        = require('./admin.routes');

const router = Router();

router.use('/auth',           authRoutes);
router.use('/users',          userRoutes);
router.use('/fields',         fieldRoutes);
router.use('/bookings',       bookingRoutes);
router.use('/teams',          teamRoutes);
router.use('/match-requests', matchRequestRoutes);
router.use('/reviews',        reviewRoutes);
router.use('/billing',        billingRoutes);
router.use('/notifications',  notificationRoutes);
router.use('/admin',          adminRoutes);

module.exports = router;
