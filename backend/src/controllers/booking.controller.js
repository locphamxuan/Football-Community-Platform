const bookingService = require('../services/booking');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const createBooking = catchAsync(async (req, res) => {
  const booking = await bookingService.createBooking(req.user.id, req.body);
  sendSuccess(res, { booking }, 'Booking created successfully', HttpStatus.CREATED);
});

const getBookingById = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const booking = await bookingService.getBookingById(req.params.id, req.user.id, isAdmin);
  sendSuccess(res, { booking });
});

const getMyBookings = catchAsync(async (req, res) => {
  const { bookings, total, page, limit } = await bookingService.getMyBookings(req.user.id, req.query);
  sendSuccess(res, { bookings }, 'Bookings retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const getTeamBookings = catchAsync(async (req, res) => {
  const { bookings, total, page, limit } = await bookingService.getTeamBookings(req.user.id, req.query);
  sendSuccess(res, { bookings }, 'Bookings retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const getFieldBookings = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const { bookings, total, page, limit } = await bookingService.getFieldBookings(req.params.fieldId, req.user.id, req.query, isAdmin);
  sendSuccess(res, { bookings }, 'Bookings retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const getOwnerBookings = catchAsync(async (req, res) => {
  const { bookings, total, page, limit } = await bookingService.getOwnerBookings(req.user.id, req.query);
  sendSuccess(res, { bookings }, 'Bookings retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const getOwnerStats = catchAsync(async (req, res) => {
  const stats = await bookingService.getOwnerStats(req.user.id);
  sendSuccess(res, { stats });
});

const getOwnerRevenue = catchAsync(async (req, res) => {
  const series = await bookingService.getOwnerRevenueSeries(req.user.id, req.query.months);
  sendSuccess(res, { series });
});

const cancelBooking = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const booking = await bookingService.cancelBooking(req.params.id, req.user.id, req.body.reason, isAdmin);
  sendSuccess(res, { booking }, 'Booking cancelled');
});

const confirmBooking = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const booking = await bookingService.confirmBooking(req.params.id, req.user.id, isAdmin);
  sendSuccess(res, { booking }, 'Booking confirmed');
});

const completeBooking = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const booking = await bookingService.completeBooking(req.params.id, req.user.id, isAdmin);
  sendSuccess(res, { booking }, 'Booking completed');
});

const markNoShow = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const booking = await bookingService.markNoShow(req.params.id, req.user.id, isAdmin);
  sendSuccess(res, { booking }, 'Booking marked as no-show');
});

module.exports = {
  createBooking, getBookingById, getMyBookings, getTeamBookings, getFieldBookings,
  getOwnerBookings, getOwnerStats, getOwnerRevenue,
  cancelBooking, confirmBooking, completeBooking, markNoShow,
};
