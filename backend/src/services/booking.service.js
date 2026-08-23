const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const Team = require('../models/Team');
const { getPagination } = require('../utils/pagination');
const { cache, CacheKeys } = require('../config/redis');
const { formatSlotLabel, toMinutes } = require('../utils/datetime');
const { notify } = require('./notification.service');
const { NotificationType } = require('../constants/notifications');
const {
  calcDuration, calcPrice, resolvePricingForDate, calcBookingPrice,
} = require('./pricing.service');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

// Người đặt phải huỷ trước giờ đá ít nhất ngần này, để chủ sân còn kịp bán lại khung giờ.
const CANCEL_WINDOW_HOURS = 2;
const MIN_DURATION_HOURS = 0.5;
const MAX_DURATION_HOURS = 6;

/**
 * Khoảng [00:00, 24:00) UTC của một ngày.
 * Booking được lưu bằng `new Date('YYYY-MM-DD')` = nửa đêm UTC, nên mọi truy vấn theo ngày
 * đều phải cắt mốc bằng UTC — dùng giờ địa phương sẽ lệch ngày trên server khác múi giờ.
 */
const dayRangeUtc = (dateInput) => {
  const d = new Date(dateInput);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86400000) };
};

/**
 * Báo giá trước khi đặt (không ghi gì vào DB) — nguồn sự thật duy nhất cho ô xem giá phía
 * client, thay vì để frontend tự ước lượng lại logic tính giá.
 * Mã khuyến mãi sai/hết hạn không làm hỏng cả báo giá — trả về giá gốc kèm `promoError`.
 */
const previewBookingPrice = async (fieldId, date, startTime, endTime, promoCode) => {
  const field = await Field.findById(fieldId).select('pricing priceOverrides promotions');
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  try {
    return calcBookingPrice(field, date, startTime, endTime, promoCode);
  } catch (err) {
    if (err instanceof AppError && err.code === ErrorCode.PROMO_CODE_INVALID) {
      const basePrice = calcPrice(resolvePricingForDate(field, date), date, startTime, endTime);
      return { totalPrice: basePrice, basePrice, discount: 0, promoCode: null, promoError: err.message };
    }
    throw err;
  }
};

const isSlotFree = async (subFieldId, date, startTime, endTime, excludeId) => {
  const { start, end } = dayRangeUtc(date);
  const q = {
    subField: new mongoose.Types.ObjectId(subFieldId),
    date: { $gte: start, $lt: end },
    status: { $in: ['pending', 'confirmed'] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) q._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  return (await Booking.countDocuments(q)) === 0;
};

/** Thời điểm bắt đầu thực tế của booking, quy về UTC giống lúc lưu. */
const bookingStartAt = (booking) => {
  const { start } = dayRangeUtc(booking.date);
  return new Date(start.getTime() + toMinutes(booking.startTime) * 60000);
};

const invalidateAvailability = (fieldId, date) => {
  const dateStr = new Date(date).toISOString().slice(0, 10);
  return cache.del(CacheKeys.fieldAvailability(fieldId.toString(), dateStr));
};

/** Chủ sân của booking, hoặc admin, mới được thao tác trên booking đó. */
const assertFieldOwnership = async (fieldId, userId, isAdmin) => {
  const field = await Field.findById(fieldId).select('owner name');
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (!isAdmin && field.owner.toString() !== userId) {
    throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
  return field;
};

// ─── createBooking ────────────────────────────────────────────────────────────
const createBooking = async (userId, data) => {
  const field = await Field.findById(data.fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (field.status !== 'active') throw new AppError('Field is not active', HttpStatus.BAD_REQUEST, ErrorCode.FIELD_NOT_ACTIVE);
  if (!field.isVerified) throw new AppError('Field has not been verified yet', HttpStatus.BAD_REQUEST, ErrorCode.FIELD_NOT_VERIFIED);

  const subField = field.subFields.id(data.subFieldId);
  if (!subField) throw new AppError('Sub-field not found', HttpStatus.NOT_FOUND, ErrorCode.SUBFIELD_NOT_FOUND);
  if (subField.status !== 'available') throw new AppError('Sub-field not available', HttpStatus.BAD_REQUEST, ErrorCode.SLOT_NOT_AVAILABLE);

  // Khung giờ phải nằm trong giờ mở cửa của sân
  const { open, close } = field.operatingHours;
  if (toMinutes(data.startTime) < toMinutes(open) || toMinutes(data.endTime) > toMinutes(close)) {
    throw new AppError(
      `Field only accepts bookings between ${open} and ${close}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.SLOT_NOT_AVAILABLE
    );
  }

  const duration = calcDuration(data.startTime, data.endTime);
  if (duration < MIN_DURATION_HOURS || duration > MAX_DURATION_HOURS) {
    throw new AppError(
      `Booking duration must be between ${MIN_DURATION_HOURS} and ${MAX_DURATION_HOURS} hours`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR
    );
  }

  // Chặn đặt khung giờ đã trôi qua trong ngày hôm nay
  const bookingDate = new Date(data.date);
  const startAt = new Date(dayRangeUtc(bookingDate).start.getTime() + toMinutes(data.startTime) * 60000);
  if (startAt.getTime() <= Date.now()) {
    throw new AppError('Cannot book a time slot in the past', HttpStatus.BAD_REQUEST, ErrorCode.SLOT_NOT_AVAILABLE);
  }

  // Chỉ được đặt hộ đội mà mình là thành viên
  if (data.teamId) {
    const team = await Team.findOne({
      _id: data.teamId,
      status: 'active',
      $or: [{ manager: userId }, { 'members.user': userId }],
    }).select('_id');
    if (!team) throw new AppError('You are not a member of this team', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  const free = await isSlotFree(data.subFieldId, bookingDate, data.startTime, data.endTime);
  if (!free) throw new AppError('This time slot is already booked', HttpStatus.CONFLICT, ErrorCode.SLOT_NOT_AVAILABLE);

  const { totalPrice, basePrice, discount, promoCode } = calcBookingPrice(
    field, bookingDate, data.startTime, data.endTime, data.promoCode
  );

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
    basePrice,
    discount,
    promoCode,
    notes: data.notes || '',
    paymentMethod: data.paymentMethod || 'cash',
  });

  // Hai request song song có thể cùng vượt qua isSlotFree — kiểm tra lại sau khi ghi và hoàn tác nếu trùng
  const stillFree = await isSlotFree(data.subFieldId, bookingDate, data.startTime, data.endTime, booking._id);
  if (!stillFree) {
    await booking.deleteOne();
    throw new AppError('This time slot has just been booked by someone else', HttpStatus.CONFLICT, ErrorCode.SLOT_NOT_AVAILABLE);
  }

  // Chỉ tính lượt dùng sau khi chắc chắn booking không bị rollback ở bước kiểm tra lại phía trên
  if (promoCode) {
    await Field.updateOne(
      { _id: field._id, 'promotions.code': promoCode },
      { $inc: { 'promotions.$.usedCount': 1 } }
    );
  }

  await invalidateAvailability(field._id, bookingDate);

  await notify(field.owner, {
    type: NotificationType.BOOKING_CREATED,
    title: 'Có lịch đặt mới chờ xác nhận',
    body: `${field.name} · ${formatSlotLabel(bookingDate, data.startTime, data.endTime)}`,
    link: '/owner/bookings',
  }, userId);

  return Booking.findById(booking._id).populate('field', 'name location images pricing');
};

// ─── getBookingById ────────────────────────────────────────────────────────────
const getBookingById = async (bookingId, userId, isAdmin = false) => {
  const booking = await Booking.findById(bookingId)
    .populate('field', 'name location images pricing')
    .populate('user', 'username fullName avatar phone');
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  if (!isAdmin && booking.user._id.toString() !== userId) {
    await assertFieldOwnership(booking.field._id, userId, false);
  }
  return booking;
};

// ─── getMyBookings ─────────────────────────────────────────────────────────────
const getMyBookings = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { user: new mongoose.Types.ObjectId(userId) };
  if (query.status) filter.status = query.status;
  if (query.startDate) filter.date = { $gte: dayRangeUtc(query.startDate).start };
  if (query.endDate) filter.date = { ...(filter.date || {}), $lt: dayRangeUtc(query.endDate).end };

  const [bookings, total] = await Promise.all([
    Booking.find(filter).populate('field', 'name location images owner').skip(skip).limit(limit).sort('-createdAt'),
    Booking.countDocuments(filter),
  ]);
  return { bookings, total, page, limit };
};

// ─── getTeamBookings ───────────────────────────────────────────────────────────
/**
 * Lịch sân của các đội mà user đang dẫn dắt — gồm cả lịch do thành viên khác đặt cho đội.
 * Thành viên thường xem lịch của chính mình ở /my-bookings.
 */
const getTeamBookings = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);

  const teamFilter = { manager: new mongoose.Types.ObjectId(userId), status: { $ne: 'disbanded' } };
  if (query.teamId) teamFilter._id = new mongoose.Types.ObjectId(query.teamId);
  const teamIds = await Team.find(teamFilter).distinct('_id');
  if (teamIds.length === 0) return { bookings: [], total: 0, page, limit };

  const filter = { team: { $in: teamIds } };
  if (query.status) filter.status = query.status;
  if (query.startDate) filter.date = { $gte: dayRangeUtc(query.startDate).start };
  if (query.endDate) filter.date = { ...(filter.date || {}), $lt: dayRangeUtc(query.endDate).end };

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('field', 'name location images')
      .populate('team', 'name logo')
      .populate('user', 'username fullName avatar phone')
      .skip(skip)
      .limit(limit)
      .sort({ date: -1, startTime: -1 }),
    Booking.countDocuments(filter),
  ]);
  return { bookings, total, page, limit };
};

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

// ─── cancelBooking ─────────────────────────────────────────────────────────────
const cancelBooking = async (bookingId, userId, reason, isAdmin = false) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const isBooker = booking.user.toString() === userId;
  // Ai huỷ cũng cần nạp sân: chủ sân để kiểm quyền (chỉ được từ chối lịch trên sân của mình),
  // người đặt và admin để biết phải báo huỷ cho chủ sân nào.
  const field = await assertFieldOwnership(booking.field, userId, isAdmin || isBooker);

  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new AppError('Booking cannot be cancelled', HttpStatus.BAD_REQUEST, ErrorCode.BOOKING_NOT_CANCELLABLE);
  }

  // Chủ sân và admin được từ chối bất cứ lúc nào; người đặt phải huỷ trước giờ đá
  if (isBooker && !isAdmin) {
    const deadline = bookingStartAt(booking).getTime() - CANCEL_WINDOW_HOURS * 3600000;
    if (Date.now() > deadline) {
      throw new AppError(
        `Bookings can only be cancelled at least ${CANCEL_WINDOW_HOURS} hours before the start time. Contact the field owner instead.`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.BOOKING_NOT_CANCELLABLE
      );
    }
  }

  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    {
      status: 'cancelled',
      cancelReason: reason,
      cancelledAt: new Date(),
      cancelledBy: new mongoose.Types.ObjectId(userId),
    },
    { new: true }
  ).populate('field', 'name location images pricing');

  await invalidateAvailability(booking.field, booking.date);

  // Huỷ luôn có hai phía: bên còn lại phải biết ngay để bán lại khung giờ hoặc tìm sân khác.
  const slot = `${field.name} · ${formatSlotLabel(booking.date, booking.startTime, booking.endTime)}`;
  await notify(isBooker ? field.owner : booking.user, {
    type: NotificationType.BOOKING_CANCELLED,
    title: isBooker ? 'Khách đã huỷ lịch đặt' : 'Lịch đặt của bạn đã bị huỷ',
    body: reason ? `${slot} — lý do: ${reason}` : slot,
    link: isBooker ? '/owner/bookings' : '/bookings',
  }, userId);

  return updated;
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
  createBooking, getBookingById, getMyBookings, getTeamBookings, getFieldBookings,
  getOwnerBookings, getOwnerStats, getOwnerRevenueSeries,
  cancelBooking, confirmBooking, completeBooking, markNoShow,
  dayRangeUtc, previewBookingPrice,
  // Re-exported từ pricing.service.js để giữ tương thích ngược cho code/test đang
  // `require('./booking.service')` để lấy các hàm tính giá — không định nghĩa lại ở đây.
  calcPrice, calcDuration, resolvePricingForDate, calcBookingPrice,
};
