const Field = require('../../models/Field');
const Booking = require('../../models/Booking');
const { getPagination } = require('../../utils/pagination');
const { cache, CacheKeys, CacheTTL } = require('../../config/redis');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');

// ─── getFields ────────────────────────────────────────────────────────────────
const getFields = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { status: 'active' };

  if (query.search) filter.$text = { $search: query.search };
  if (query.city) filter['location.city'] = { $regex: query.city, $options: 'i' };
  if (query.district) filter['location.district'] = { $regex: query.district, $options: 'i' };
  if (query.minRating) filter['rating.average'] = { $gte: Number(query.minRating) };

  if (query.lat && query.lng) {
    filter['location.coordinates'] = {
      $near: {
        $geometry: { type: 'Point', coordinates: [Number(query.lng), Number(query.lat)] },
        $maxDistance: (Number(query.radius) || 10) * 1000,
      },
    };
  }

  const sortMap = {
    rating: { 'rating.average': -1 },
    price: { 'pricing.weekday.evening': 1 },
    newest: { createdAt: -1 },
    popular: { totalBookings: -1 },
  };
  const sort = sortMap[query.sort] || { 'rating.average': -1 };

  const [fields, total] = await Promise.all([
    Field.find(filter).populate('owner', 'username fullName avatar').skip(skip).limit(limit).sort(sort),
    Field.countDocuments(filter),
  ]);

  return { fields, total, page, limit };
};

// ─── getFieldById ─────────────────────────────────────────────────────────────
const getFieldById = async (id) => {
  const cached = await cache.getJSON(CacheKeys.field(id));
  if (cached) return cached;

  const field = await Field.findById(id).populate('owner', 'username fullName avatar phone');
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  await cache.setJSON(CacheKeys.field(id), field, CacheTTL.FIELD);
  return field;
};

// ─── Availability ─────────────────────────────────────────────────────────────
const checkAvailability = async (fieldId, { date, startTime, endTime, fieldType }) => {
  const field = await Field.findById(fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (field.status !== 'active') throw new AppError('Field not active', HttpStatus.BAD_REQUEST, ErrorCode.FIELD_NOT_ACTIVE);

  const cacheKey = CacheKeys.fieldAvailability(fieldId, date);
  const cached = await cache.getJSON(cacheKey);
  if (cached) return cached;

  const bookingDate = new Date(date);
  const bookedSlots = await Booking.find({
    field: fieldId,
    date: { $gte: bookingDate, $lt: new Date(bookingDate.getTime() + 86400000) },
    status: { $in: ['pending', 'confirmed'] },
  }).select('subField startTime endTime').lean();

  const targets = fieldType
    ? field.subFields.filter((s) => s.fieldType === fieldType && s.status === 'available')
    : field.subFields.filter((s) => s.status === 'available');

  const result = targets.map((sf) => {
    const sfBookings = bookedSlots.filter((b) => b.subField.toString() === sf._id.toString());
    const isAvailable = !sfBookings.some((b) => !(b.endTime <= startTime || b.startTime >= endTime));
    return {
      subFieldId: sf._id,
      name: sf.name,
      fieldType: sf.fieldType,
      surface: sf.surface,
      isAvailable,
      bookedSlots: sfBookings.map((b) => ({ startTime: b.startTime, endTime: b.endTime })),
    };
  });

  await cache.setJSON(cacheKey, result, CacheTTL.FIELD_AVAILABILITY);
  return result;
};

module.exports = { getFields, getFieldById, checkAvailability };
