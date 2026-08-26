const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Field = require('../../models/Field');
const { cache, CacheKeys } = require('../../config/redis');
const { toMinutes } = require('../../utils/datetime');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');

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

module.exports = {
  dayRangeUtc, isSlotFree, bookingStartAt, invalidateAvailability, assertFieldOwnership,
};
