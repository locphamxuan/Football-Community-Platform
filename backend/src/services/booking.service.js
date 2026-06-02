const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const { getPagination } = require('../utils/pagination');
const { cache, CacheKeys } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

// ─── helpers ──────────────────────────────────────────────────────────────────
const calcDuration = (start, end) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
};

const calcPrice = (pricing, date, startTime, duration) => {
  const isWeekend = [0, 6].includes(date.getDay());
  const slots = isWeekend ? pricing.weekend : pricing.weekday;
  const hour = parseInt(startTime.split(':')[0], 10);
  const pph = hour < 12 ? slots.morning : hour < 18 ? slots.afternoon : slots.evening;
  return pph * duration;
};

const isSlotFree = async (subFieldId, date, startTime, endTime, excludeId) => {
  const q = {
    subField: new mongoose.Types.ObjectId(subFieldId),
    date: { $gte: new Date(date.toDateString()), $lt: new Date(date.getTime() + 86400000) },
    status: { $in: ['pending', 'confirmed'] },
    $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
  };
  if (excludeId) q._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  return (await Booking.countDocuments(q)) === 0;
};

// ─── createBooking ────────────────────────────────────────────────────────────
const createBooking = async (userId, data) => {
  const field = await Field.findById(data.fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (field.status !== 'active') throw new AppError('Field is not active', HttpStatus.BAD_REQUEST, ErrorCode.FIELD_NOT_ACTIVE);

  const subField = field.subFields.id(data.subFieldId);
  if (!subField) throw new AppError('Sub-field not found', HttpStatus.NOT_FOUND, ErrorCode.SUBFIELD_NOT_FOUND);
  if (subField.status !== 'available') throw new AppError('Sub-field not available', HttpStatus.BAD_REQUEST, ErrorCode.SLOT_NOT_AVAILABLE);

  const bookingDate = new Date(data.date);
  const free = await isSlotFree(data.subFieldId, bookingDate, data.startTime, data.endTime);
  if (!free) throw new AppError('This time slot is already booked', HttpStatus.CONFLICT, ErrorCode.SLOT_NOT_AVAILABLE);

  const duration = calcDuration(data.startTime, data.endTime);
  const totalPrice = calcPrice(field.pricing, bookingDate, data.startTime, duration);

  const booking = await Booking.create({
    field: field._id,
    subField: new mongoose.Types.ObjectId(data.subFieldId),
    user: new mongoose.Types.ObjectId(userId),
    team: data.teamId ? new mongoose.Types.ObjectId(data.teamId) : undefined,
    date: bookingDate,
    startTime: data.startTime,
    endTime: data.endTime,
    duration,
    totalPrice,
    notes: data.notes || '',
    paymentMethod: data.paymentMethod || 'cash',
  });

  await cache.del(CacheKeys.fieldAvailability(data.fieldId, data.date));

  return Booking.findById(booking._id).populate('field', 'name location images pricing');
};

// ─── getBookingById ────────────────────────────────────────────────────────────
const getBookingById = async (bookingId, userId, isAdmin = false) => {
  const booking = await Booking.findById(bookingId)
    .populate('field', 'name location images pricing')
    .populate('user', 'username fullName avatar phone');
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  if (!isAdmin && booking.user._id.toString() !== userId) {
    const field = await Field.findById(booking.field._id);
    if (!field || field.owner.toString() !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }
  }
  return booking;
};

// ─── getMyBookings ─────────────────────────────────────────────────────────────
const getMyBookings = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { user: new mongoose.Types.ObjectId(userId) };
  if (query.status) filter.status = query.status;
  if (query.startDate) filter.date = { $gte: new Date(query.startDate) };
  if (query.endDate) filter.date = { ...(filter.date || {}), $lte: new Date(query.endDate) };

  const [bookings, total] = await Promise.all([
    Booking.find(filter).populate('field', 'name location images').skip(skip).limit(limit).sort('-createdAt'),
    Booking.countDocuments(filter),
  ]);
  return { bookings, total, page, limit };
};

// ─── getFieldBookings ──────────────────────────────────────────────────────────
const getFieldBookings = async (fieldId, ownerId, query) => {
  const field = await Field.findById(fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (field.owner.toString() !== ownerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const { page, limit, skip } = getPagination(query);
  const filter = { field: new mongoose.Types.ObjectId(fieldId) };
  if (query.status) filter.status = query.status;
  if (query.startDate) filter.date = { $gte: new Date(query.startDate) };
  if (query.endDate) filter.date = { ...(filter.date || {}), $lte: new Date(query.endDate) };

  const [bookings, total] = await Promise.all([
    Booking.find(filter).populate('user', 'username fullName avatar phone').skip(skip).limit(limit).sort('-date'),
    Booking.countDocuments(filter),
  ]);
  return { bookings, total, page, limit };
};

// ─── cancelBooking ─────────────────────────────────────────────────────────────
const cancelBooking = async (bookingId, userId, reason, isAdmin = false) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (!isAdmin && booking.user.toString() !== userId) {
    throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new AppError('Booking cannot be cancelled', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }

  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    { status: 'cancelled', cancelReason: reason, cancelledAt: new Date(), cancelledBy: new mongoose.Types.ObjectId(userId) },
    { new: true }
  ).populate('field', 'name location images pricing');

  const dateStr = booking.date.toISOString().split('T')[0];
  await cache.del(CacheKeys.fieldAvailability(booking.field.toString(), dateStr));
  return updated;
};

// ─── confirmBooking ────────────────────────────────────────────────────────────
const confirmBooking = async (bookingId, ownerId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const field = await Field.findById(booking.field);
  if (!field || field.owner.toString() !== ownerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  if (booking.status !== 'pending') throw new AppError('Only pending bookings can be confirmed', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);

  return Booking.findByIdAndUpdate(bookingId, { status: 'confirmed', confirmedAt: new Date() }, { new: true })
    .populate('field', 'name location images pricing');
};

// ─── completeBooking ───────────────────────────────────────────────────────────
const completeBooking = async (bookingId, ownerId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const field = await Field.findById(booking.field);
  if (!field || field.owner.toString() !== ownerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  if (booking.status !== 'confirmed') throw new AppError('Only confirmed bookings can be completed', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);

  await Field.findByIdAndUpdate(booking.field, { $inc: { totalBookings: 1 } });
  return Booking.findByIdAndUpdate(bookingId, { status: 'completed', paymentStatus: 'paid' }, { new: true })
    .populate('field', 'name location images pricing');
};

const markNoShow = async (bookingId, ownerId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const field = await Field.findById(booking.field);
  if (!field || field.owner.toString() !== ownerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  return Booking.findByIdAndUpdate(bookingId, { status: 'no_show' }, { new: true });
};

module.exports = { createBooking, getBookingById, getMyBookings, getFieldBookings, cancelBooking, confirmBooking, completeBooking, markNoShow };
