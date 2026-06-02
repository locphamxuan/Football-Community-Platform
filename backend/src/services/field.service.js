const mongoose = require('mongoose');
const slugify = require('slugify');
const Field = require('../models/Field');
const Booking = require('../models/Booking');
const { uploadMultipleImages, deleteImage } = require('../config/cloudinary');
const { getPagination } = require('../utils/pagination');
const { cache, CacheKeys, CacheTTL } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateUniqueSlug = async (base, excludeId) => {
  let slug = base;
  let counter = 0;
  for (;;) {
    const q = excludeId ? { slug, _id: { $ne: excludeId } } : { slug };
    const exists = await Field.exists(q);
    if (!exists) return slug;
    slug = `${base}-${++counter}`;
  }
};

const calculatePrice = (pricing, date, startTime, duration) => {
  const isWeekend = [0, 6].includes(date.getDay());
  const slots = isWeekend ? pricing.weekend : pricing.weekday;
  const hour = parseInt(startTime.split(':')[0], 10);
  const pricePerHour = hour < 12 ? slots.morning : hour < 18 ? slots.afternoon : slots.evening;
  return pricePerHour * duration;
};

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

// ─── createField ──────────────────────────────────────────────────────────────
const createField = async (ownerId, data, files = []) => {
  const slug = await generateUniqueSlug(slugify(data.name, { lower: true, strict: true }));

  let images = [];
  if (files.length > 0) {
    const uploaded = await uploadMultipleImages(files, 'fields');
    images = uploaded.map((u) => u.url);
  }

  const fieldData = {
    ...data,
    slug,
    images,
    owner: new mongoose.Types.ObjectId(ownerId),
    location: {
      ...data.location,
      coordinates: data.location.coordinates
        ? { type: 'Point', coordinates: [data.location.coordinates.lng, data.location.coordinates.lat] }
        : { type: 'Point', coordinates: [0, 0] },
    },
  };

  return Field.create(fieldData);
};

// ─── updateField ──────────────────────────────────────────────────────────────
const updateField = async (fieldId, ownerId, data, files = [], isAdmin = false) => {
  const field = await Field.findById(fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (!isAdmin && field.owner.toString() !== ownerId) {
    throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  let images = field.images;
  if (files.length > 0) {
    const uploaded = await uploadMultipleImages(files, 'fields');
    images = [...images, ...uploaded.map((u) => u.url)];
  }

  const updateData = { ...data, images };
  if (data.name && data.name !== field.name) {
    updateData.slug = await generateUniqueSlug(slugify(data.name, { lower: true, strict: true }), fieldId);
  }
  if (data.location?.coordinates) {
    updateData.location = {
      ...field.location.toObject(),
      ...data.location,
      coordinates: { type: 'Point', coordinates: [data.location.coordinates.lng, data.location.coordinates.lat] },
    };
  }

  const updated = await Field.findByIdAndUpdate(fieldId, updateData, { new: true });
  await cache.del(CacheKeys.field(fieldId));
  return updated;
};

// ─── deleteField ──────────────────────────────────────────────────────────────
const deleteField = async (fieldId, ownerId, isAdmin = false) => {
  const field = await Field.findById(fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (!isAdmin && field.owner.toString() !== ownerId) {
    throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  await Promise.all(
    field.images.map((img) => {
      const m = img.match(/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/);
      return m ? deleteImage(m[1]).catch(() => null) : null;
    })
  );

  await field.deleteOne();
  await cache.del(CacheKeys.field(fieldId));
};

// ─── Sub-field helpers ─────────────────────────────────────────────────────────
const addSubField = async (fieldId, ownerId, data) => {
  const field = await Field.findById(fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (field.owner.toString() !== ownerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  field.subFields.push({ ...data, status: 'available' });
  await field.save();
  await cache.del(CacheKeys.field(fieldId));
  return field;
};

const updateSubField = async (fieldId, subFieldId, ownerId, data) => {
  const field = await Field.findById(fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (field.owner.toString() !== ownerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const sub = field.subFields.id(subFieldId);
  if (!sub) throw new AppError('Sub-field not found', HttpStatus.NOT_FOUND, ErrorCode.SUBFIELD_NOT_FOUND);

  Object.assign(sub, data);
  await field.save();
  await cache.del(CacheKeys.field(fieldId));
  return field;
};

const deleteSubField = async (fieldId, subFieldId, ownerId) => {
  const field = await Field.findById(fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (field.owner.toString() !== ownerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const sub = field.subFields.id(subFieldId);
  if (!sub) throw new AppError('Sub-field not found', HttpStatus.NOT_FOUND, ErrorCode.SUBFIELD_NOT_FOUND);

  sub.deleteOne();
  await field.save();
  await cache.del(CacheKeys.field(fieldId));
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

const verifyField = async (fieldId) => {
  const field = await Field.findByIdAndUpdate(fieldId, { isVerified: true, status: 'active' }, { new: true });
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  await cache.del(CacheKeys.field(fieldId));
  return field;
};

const getMyFields = (ownerId) => Field.find({ owner: ownerId }).sort('-createdAt');

module.exports = {
  getFields, getFieldById, createField, updateField, deleteField,
  addSubField, updateSubField, deleteSubField,
  checkAvailability, verifyField, getMyFields,
  calculatePrice,
};
