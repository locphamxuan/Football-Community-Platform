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

// ─── getOwnerBookings ──────────────────────────────────────────────────────────
/**
 * Lịch đặt trên TẤT CẢ sân của một chủ sân (hoặc một sân cụ thể qua query.fieldId).
 * Gắn kèm tên sân con vì sub-field là sub-document nhúng trong Field, không populate được.
 */
const getOwnerBookings = async (ownerId, query) => {
  const { page, limit, skip } = getPagination(query);

  const fieldFilter = { owner: new mongoose.Types.ObjectId(ownerId) };
  if (query.fieldId) fieldFilter._id = new mongoose.Types.ObjectId(query.fieldId);

  const fields = await Field.find(fieldFilter).select('name location subFields').lean();
  if (fields.length === 0) return { bookings: [], total: 0, page, limit };

  const filter = { field: { $in: fields.map((f) => f._id) } };
  if (query.status) filter.status = query.status;
  if (query.startDate) filter.date = { $gte: new Date(query.startDate) };
  if (query.endDate) filter.date = { ...(filter.date || {}), $lte: new Date(query.endDate) };

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('user', 'username fullName avatar phone')
      .populate('team', 'name logo')
      .skip(skip)
      .limit(limit)
      .sort({ date: -1, startTime: -1 })
      .lean(),
    Booking.countDocuments(filter),
  ]);

  const fieldMap = new Map(fields.map((f) => [f._id.toString(), f]));
  const enriched = bookings.map((b) => {
    const field = fieldMap.get(b.field.toString());
    const sub = field?.subFields.find((s) => s._id.toString() === b.subField.toString());
    return {
      ...b,
      field: field ? { _id: field._id, name: field.name, location: field.location } : b.field,
      subFieldName: sub?.name ?? 'Sân con đã gỡ',
      subFieldType: sub?.fieldType ?? '',
    };
  });

  return { bookings: enriched, total, page, limit };
};

// ─── getOwnerStats ─────────────────────────────────────────────────────────────
/** Số liệu tổng quan cho dashboard chủ sân. */
const getOwnerStats = async (ownerId) => {
  const fields = await Field.find({ owner: ownerId }).select('status rating').lean();
  const fieldIds = fields.map((f) => f._id);

  const empty = {
    totalFields: fields.length,
    activeFields: fields.filter((f) => f.status === 'active').length,
    averageRating: 0,
    pendingBookings: 0,
    todayBookings: 0,
    completedBookings: 0,
    monthRevenue: 0,
  };
  if (fieldIds.length === 0) return empty;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [statusCounts, todayBookings, revenueAgg] = await Promise.all([
    Booking.aggregate([
      { $match: { field: { $in: fieldIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.countDocuments({
      field: { $in: fieldIds },
      date: { $gte: startOfToday, $lt: startOfTomorrow },
      status: { $in: ['pending', 'confirmed'] },
    }),
    Booking.aggregate([
      {
        $match: {
          field: { $in: fieldIds },
          status: 'completed',
          date: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  const rated = fields.filter((f) => f.rating?.count > 0);
  const averageRating = rated.length > 0
    ? rated.reduce((sum, f) => sum + f.rating.average, 0) / rated.length
    : 0;

  return {
    ...empty,
    averageRating: Math.round(averageRating * 10) / 10,
    pendingBookings: byStatus.pending ?? 0,
    todayBookings,
    completedBookings: byStatus.completed ?? 0,
    monthRevenue: revenueAgg[0]?.total ?? 0,
  };
};

// ─── cancelBooking ─────────────────────────────────────────────────────────────
const cancelBooking = async (bookingId, userId, reason, isAdmin = false) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  // Người đặt tự huỷ, hoặc chủ sân từ chối lịch đặt trên sân của mình
  if (!isAdmin && booking.user.toString() !== userId) {
    const field = await Field.findById(booking.field).select('owner');
    if (!field || field.owner.toString() !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }
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

  // Chỉ đánh no-show cho booking đã xác nhận và đã qua giờ bắt đầu
  if (booking.status !== 'confirmed') {
    throw new AppError('Only confirmed bookings can be marked as no-show', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }
  const startAt = new Date(`${booking.date.toISOString().slice(0, 10)}T${booking.startTime}:00`);
  if (startAt > new Date()) {
    throw new AppError('Cannot mark no-show before the booking start time', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }

  return Booking.findByIdAndUpdate(bookingId, { status: 'no_show' }, { new: true });
};

module.exports = {
  createBooking, getBookingById, getMyBookings, getFieldBookings,
  getOwnerBookings, getOwnerStats,
  cancelBooking, confirmBooking, completeBooking, markNoShow,
};
