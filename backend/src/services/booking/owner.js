const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Field = require('../../models/Field');
const { getPagination } = require('../../utils/pagination');
const { formatSlotLabel } = require('../../utils/datetime');
const { notify } = require('../notification.service');
const { NotificationType } = require('../../constants/notifications');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');
const {
  dayRangeUtc, assertFieldOwnership, bookingStartAt, invalidateAvailability,
} = require('./helpers');

// ─── getFieldBookings ──────────────────────────────────────────────────────────
const getFieldBookings = async (fieldId, ownerId, query, isAdmin = false) => {
  await assertFieldOwnership(fieldId, ownerId, isAdmin);

  const { page, limit, skip } = getPagination(query);
  const filter = { field: new mongoose.Types.ObjectId(fieldId) };
  if (query.status) filter.status = query.status;
  if (query.startDate) filter.date = { $gte: dayRangeUtc(query.startDate).start };
  if (query.endDate) filter.date = { ...(filter.date || {}), $lt: dayRangeUtc(query.endDate).end };

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
  if (query.startDate) filter.date = { $gte: dayRangeUtc(query.startDate).start };
  if (query.endDate) filter.date = { ...(filter.date || {}), $lt: dayRangeUtc(query.endDate).end };

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
  const fields = await Field.find({ owner: ownerId }).select('status rating subFields').lean();
  const fieldIds = fields.map((f) => f._id);

  const empty = {
    totalFields: fields.length,
    activeFields: fields.filter((f) => f.status === 'active').length,
    totalSubFields: fields.reduce((sum, f) => sum + (f.subFields?.length ?? 0), 0),
    averageRating: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    todayBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    noShowBookings: 0,
    monthRevenue: 0,
    lastMonthRevenue: 0,
    upcomingBookings: 0,
  };
  if (fieldIds.length === 0) return empty;

  const now = new Date();
  const { start: startOfToday, end: startOfTomorrow } = dayRangeUtc(now.toISOString().slice(0, 10));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const [statusCounts, todayBookings, upcomingBookings, revenueAgg] = await Promise.all([
    Booking.aggregate([
      { $match: { field: { $in: fieldIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.countDocuments({
      field: { $in: fieldIds },
      date: { $gte: startOfToday, $lt: startOfTomorrow },
      status: { $in: ['pending', 'confirmed'] },
    }),
    Booking.countDocuments({
      field: { $in: fieldIds },
      date: { $gte: startOfTomorrow },
      status: { $in: ['pending', 'confirmed'] },
    }),
    Booking.aggregate([
      {
        $match: {
          field: { $in: fieldIds },
          status: 'completed',
          date: { $gte: startOfLastMonth },
        },
      },
      {
        $group: {
          _id: { $cond: [{ $gte: ['$date', startOfMonth] }, 'current', 'previous'] },
          total: { $sum: '$totalPrice' },
        },
      },
    ]),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  const revenue = Object.fromEntries(revenueAgg.map((r) => [r._id, r.total]));
  const rated = fields.filter((f) => f.rating?.count > 0);
  const averageRating = rated.length > 0
    ? rated.reduce((sum, f) => sum + f.rating.average, 0) / rated.length
    : 0;

  return {
    ...empty,
    averageRating: Math.round(averageRating * 10) / 10,
    pendingBookings: byStatus.pending ?? 0,
    confirmedBookings: byStatus.confirmed ?? 0,
    todayBookings,
    upcomingBookings,
    completedBookings: byStatus.completed ?? 0,
    cancelledBookings: byStatus.cancelled ?? 0,
    noShowBookings: byStatus.no_show ?? 0,
    monthRevenue: revenue.current ?? 0,
    lastMonthRevenue: revenue.previous ?? 0,
  };
};

// ─── getOwnerRevenueSeries ─────────────────────────────────────────────────────
/** Doanh thu và số lượt đặt theo tháng của chủ sân, dùng cho biểu đồ dashboard. */
const getOwnerRevenueSeries = async (ownerId, months = 6) => {
  const span = Math.min(Math.max(Number(months) || 6, 1), 24);
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (span - 1), 1));

  const fieldIds = await Field.find({ owner: ownerId }).distinct('_id');

  const rows = fieldIds.length
    ? await Booking.aggregate([
      { $match: { field: { $in: fieldIds }, date: { $gte: from } } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          bookings: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalPrice', 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        },
      },
    ])
    : [];

  const idx = Object.fromEntries(
    rows.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r])
  );

  const series = [];
  for (let i = 0; i < span; i += 1) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    series.push({
      month: key,
      label: `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`,
      revenue: idx[key]?.revenue ?? 0,
      bookings: idx[key]?.bookings ?? 0,
      completed: idx[key]?.completed ?? 0,
      cancelled: idx[key]?.cancelled ?? 0,
    });
  }
  return series;
};

// ─── confirmBooking ────────────────────────────────────────────────────────────
const confirmBooking = async (bookingId, ownerId, isAdmin = false) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  const field = await assertFieldOwnership(booking.field, ownerId, isAdmin);

  if (booking.status !== 'pending') {
    throw new AppError('Only pending bookings can be confirmed', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }

  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    { status: 'confirmed', confirmedAt: new Date() },
    { new: true }
  ).populate('field', 'name location images pricing');

  await notify(booking.user, {
    type: NotificationType.BOOKING_CONFIRMED,
    title: 'Lịch đặt đã được xác nhận',
    body: `${field.name} · ${formatSlotLabel(booking.date, booking.startTime, booking.endTime)}`,
    link: '/bookings',
  }, ownerId);

  return updated;
};

// ─── completeBooking ───────────────────────────────────────────────────────────
const completeBooking = async (bookingId, ownerId, isAdmin = false) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  await assertFieldOwnership(booking.field, ownerId, isAdmin);

  if (booking.status !== 'confirmed') {
    throw new AppError('Only confirmed bookings can be completed', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }
  // Không thể kết thúc một trận chưa diễn ra
  if (bookingStartAt(booking).getTime() > Date.now()) {
    throw new AppError('Cannot complete a booking before it starts', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }

  await Field.findByIdAndUpdate(booking.field, { $inc: { totalBookings: 1 } });
  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    { status: 'completed', paymentStatus: 'paid' },
    { new: true }
  ).populate('field', 'name location images pricing');

  await invalidateAvailability(booking.field, booking.date);
  return updated;
};

// ─── markNoShow ────────────────────────────────────────────────────────────────
const markNoShow = async (bookingId, ownerId, isAdmin = false) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  await assertFieldOwnership(booking.field, ownerId, isAdmin);

  // Chỉ đánh no-show cho booking đã xác nhận và đã qua giờ bắt đầu
  if (booking.status !== 'confirmed') {
    throw new AppError('Only confirmed bookings can be marked as no-show', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }
  if (bookingStartAt(booking).getTime() > Date.now()) {
    throw new AppError('Cannot mark no-show before the booking start time', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }

  const updated = await Booking.findByIdAndUpdate(bookingId, { status: 'no_show' }, { new: true });
  await invalidateAvailability(booking.field, booking.date);
  return updated;
};

module.exports = {
  getFieldBookings, getOwnerBookings, getOwnerStats, getOwnerRevenueSeries,
  confirmBooking, completeBooking, markNoShow,
};
