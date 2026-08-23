const Field = require('../models/Field');
const { cache, CacheKeys } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

/**
 * Quản lý ghi đè giá theo ngày và mã khuyến mãi của chủ sân — tách riêng khỏi
 * field.service.js (CRUD sân/sân con) vì đây là một nhánh nghiệp vụ khác, chỉ chủ sân
 * (và admin thay mặt) thao tác, không liên quan tới thông tin sân cốt lõi.
 */

const loadOwnedField = async (fieldId, ownerId, isAdmin) => {
  const field = await Field.findById(fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (!isAdmin && field.owner.toString() !== ownerId) {
    throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
  return field;
};

// ─── Price overrides ────────────────────────────────────────────────────────────
const addPriceOverride = async (fieldId, ownerId, data, isAdmin = false) => {
  const field = await loadOwnedField(fieldId, ownerId, isAdmin);
  field.priceOverrides.push(data);
  await field.save();
  await cache.del(CacheKeys.field(fieldId));
  return field;
};

const deletePriceOverride = async (fieldId, overrideId, ownerId, isAdmin = false) => {
  const field = await loadOwnedField(fieldId, ownerId, isAdmin);
  const override = field.priceOverrides.id(overrideId);
  if (!override) {
    throw new AppError('Price override not found', HttpStatus.NOT_FOUND, ErrorCode.PRICE_OVERRIDE_NOT_FOUND);
  }
  override.deleteOne();
  await field.save();
  await cache.del(CacheKeys.field(fieldId));
  return field;
};

// ─── Promotions ───────────────────────────────────────────────────────────────
const addPromotion = async (fieldId, ownerId, data, isAdmin = false) => {
  const field = await loadOwnedField(fieldId, ownerId, isAdmin);
  const code = data.code.toUpperCase().trim();

  // Hai mã khuyến mãi trùng nhau còn hiệu lực cùng lúc sẽ không rõ resolvePromotion nên chọn cái nào
  const duplicate = field.promotions.some((p) => p.code === code && p.active);
  if (duplicate) {
    throw new AppError('An active promotion with this code already exists', HttpStatus.BAD_REQUEST, ErrorCode.DUPLICATE_PROMO_CODE);
  }

  field.promotions.push({ ...data, code });
  await field.save();
  await cache.del(CacheKeys.field(fieldId));
  return field;
};

const updatePromotion = async (fieldId, promoId, ownerId, data, isAdmin = false) => {
  const field = await loadOwnedField(fieldId, ownerId, isAdmin);
  const promo = field.promotions.id(promoId);
  if (!promo) throw new AppError('Promotion not found', HttpStatus.NOT_FOUND, ErrorCode.PROMOTION_NOT_FOUND);

  Object.assign(promo, data);
  await field.save();
  await cache.del(CacheKeys.field(fieldId));
  return field;
};

const deletePromotion = async (fieldId, promoId, ownerId, isAdmin = false) => {
  const field = await loadOwnedField(fieldId, ownerId, isAdmin);
  const promo = field.promotions.id(promoId);
  if (!promo) throw new AppError('Promotion not found', HttpStatus.NOT_FOUND, ErrorCode.PROMOTION_NOT_FOUND);

  promo.deleteOne();
  await field.save();
  await cache.del(CacheKeys.field(fieldId));
  return field;
};

module.exports = {
  addPriceOverride, deletePriceOverride,
  addPromotion, updatePromotion, deletePromotion,
};
