const { toMinutes } = require('../utils/datetime');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

/**
 * Toàn bộ logic tính giá sân — thuần, không chạm DB — tách riêng khỏi booking.service.js
 * (vòng đời booking: tạo/huỷ/xác nhận) để mỗi file chỉ giữ một nhánh nghiệp vụ.
 */

const calcDuration = (start, end) => (toMinutes(end) - toMinutes(start)) / 60;

// Ba khung giá trong ngày, tính theo phút kể từ 00:00.
const PRICE_SLOTS = [
  { key: 'morning', from: 0, to: 12 * 60 },
  { key: 'afternoon', from: 12 * 60, to: 18 * 60 },
  { key: 'evening', from: 18 * 60, to: 24 * 60 },
];

/**
 * Số tiền của từng khung giá, theo phần thời gian thực nằm trong khung đó.
 * Đặt 17:00–20:00 phải tính 1h giá chiều + 2h giá tối, không phải 3h giá chiều.
 * Đây là hàm duy nhất làm phép tính overlap-thời-gian × đơn giá — calcPrice và mọi
 * biến thể giá (ghi đè theo ngày, khuyến mãi) đều phải đi qua đây, không viết nhánh mới.
 */
const calcSlotAmounts = (pricing, date, startTime, endTime) => {
  const isWeekend = [0, 6].includes(new Date(date).getUTCDay());
  const rates = isWeekend ? pricing.weekend : pricing.weekday;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  return PRICE_SLOTS.reduce((acc, slot) => {
    const overlap = Math.min(end, slot.to) - Math.max(start, slot.from);
    acc[slot.key] = overlap > 0 ? (rates[slot.key] * overlap) / 60 : 0;
    return acc;
  }, {});
};

const calcPrice = (pricing, date, startTime, endTime) =>
  Math.round(Object.values(calcSlotAmounts(pricing, date, startTime, endTime)).reduce((a, b) => a + b, 0));

/**
 * Bảng giá áp dụng cho một ngày cụ thể — ưu tiên ghi đè (lễ/Tết, giá theo mùa) nếu ngày
 * rơi vào khoảng của một ghi đè, ngược lại dùng giá weekday/weekend mặc định của sân.
 */
const resolvePricingForDate = (field, date) => {
  const d = new Date(date);
  const override = (field.priceOverrides || []).find(
    (o) => d >= new Date(o.startDate) && d <= new Date(o.endDate)
  );
  return override ? { weekday: override.weekday, weekend: override.weekend } : field.pricing;
};

/** Tìm mã khuyến mãi còn hiệu lực trên sân, cho đúng ngày đặt. Ném lỗi nếu mã không hợp lệ. */
const resolvePromotion = (field, code, date) => {
  if (!code) return null;
  const d = new Date(date);
  const normalized = code.toUpperCase().trim();
  const promo = (field.promotions || []).find(
    (p) => p.code === normalized
      && p.active
      && d >= new Date(p.startDate) && d <= new Date(p.endDate)
      && (p.maxUses == null || p.usedCount < p.maxUses)
  );
  if (!promo) {
    throw new AppError('Invalid or expired promo code', HttpStatus.BAD_REQUEST, ErrorCode.PROMO_CODE_INVALID);
  }
  return promo;
};

/**
 * Giá cuối cùng của một lượt đặt: giá theo bảng giá hiệu lực của ngày đó, trừ khuyến mãi
 * (nếu có mã hợp lệ). Khuyến mãi giới hạn theo khung giờ chỉ trừ trên phần tiền của đúng
 * những khung đó, không trừ trên tổng.
 */
const calcBookingPrice = (field, date, startTime, endTime, promoCode) => {
  const pricing = resolvePricingForDate(field, date);
  const slotAmounts = calcSlotAmounts(pricing, date, startTime, endTime);
  const basePrice = Math.round(Object.values(slotAmounts).reduce((a, b) => a + b, 0));

  const promotion = promoCode ? resolvePromotion(field, promoCode, date) : null;
  if (!promotion) {
    return { totalPrice: basePrice, basePrice, discount: 0, promoCode: null };
  }

  const scopedSlots = promotion.slots?.length ? promotion.slots : Object.keys(slotAmounts);
  const discountBase = scopedSlots.reduce((sum, key) => sum + (slotAmounts[key] || 0), 0);
  const rawDiscount = promotion.type === 'percentage'
    ? (discountBase * promotion.value) / 100
    : Math.min(promotion.value, discountBase);
  const discount = Math.round(rawDiscount);

  return { totalPrice: Math.max(basePrice - discount, 0), basePrice, discount, promoCode: promotion.code };
};

module.exports = {
  calcDuration, calcSlotAmounts, calcPrice,
  resolvePricingForDate, resolvePromotion, calcBookingPrice,
};
