const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Field = require('../../models/Field');
const Team = require('../../models/Team');
const { getPagination } = require('../../utils/pagination');
const { formatSlotLabel, toMinutes } = require('../../utils/datetime');
const { notify } = require('../notification.service');
const { NotificationType } = require('../../constants/notifications');
const { calcDuration, calcBookingPrice } = require('../pricing.service');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');
const { dayRangeUtc, isSlotFree, invalidateAvailability } = require('./helpers');

const MIN_DURATION_HOURS = 0.5;
const MAX_DURATION_HOURS = 6;

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

module.exports = { createBooking, getMyBookings };
