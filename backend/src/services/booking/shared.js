const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Field = require('../../models/Field');
const { formatSlotLabel } = require('../../utils/datetime');
const { notify } = require('../notification.service');
const { NotificationType } = require('../../constants/notifications');
const {
  calcPrice, resolvePricingForDate, calcBookingPrice,
} = require('../pricing.service');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');
const { assertFieldOwnership, bookingStartAt, invalidateAvailability } = require('./helpers');

// Người đặt phải huỷ trước giờ đá ít nhất ngần này, để chủ sân còn kịp bán lại khung giờ.
const CANCEL_WINDOW_HOURS = 2;

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

module.exports = { previewBookingPrice, getBookingById, cancelBooking };
