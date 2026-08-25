const {
  calcSlotAmounts, resolvePricingForDate, resolvePromotion, calcBookingPrice,
} = require('../../src/services/pricing.service');

// 2026-08-10 là thứ hai, 2026-08-15 là thứ bảy (tính theo UTC như calcPrice)
const MONDAY = '2026-08-10';
const SATURDAY = '2026-08-15';

const pricing = {
  weekday: { morning: 100000, afternoon: 200000, evening: 300000 },
  weekend: { morning: 150000, afternoon: 250000, evening: 400000 },
};

const holidayPricing = {
  weekday: { morning: 200000, afternoon: 400000, evening: 600000 },
  weekend: { morning: 300000, afternoon: 500000, evening: 800000 },
};

const baseField = { pricing, priceOverrides: [], promotions: [] };

describe('calcSlotAmounts', () => {
  it('trả về số tiền của từng khung, khung không chạm giờ đặt bằng 0', () => {
    expect(calcSlotAmounts(pricing, MONDAY, '19:00', '21:00')).toEqual({
      morning: 0, afternoon: 0, evening: 600000,
    });
  });

  it('chia đúng phần thời gian nằm trong từng khung', () => {
    expect(calcSlotAmounts(pricing, MONDAY, '17:00', '20:00')).toEqual({
      morning: 0, afternoon: 200000, evening: 600000,
    });
  });
});

describe('resolvePricingForDate', () => {
  const field = {
    pricing,
    priceOverrides: [
      { name: 'Tết', startDate: '2026-08-10', endDate: '2026-08-12', weekday: holidayPricing.weekday, weekend: holidayPricing.weekend },
    ],
  };

  it('dùng giá ghi đè khi ngày rơi vào khoảng ghi đè', () => {
    expect(resolvePricingForDate(field, '2026-08-11')).toEqual({
      weekday: holidayPricing.weekday, weekend: holidayPricing.weekend,
    });
  });

  it('dùng giá mặc định khi ngày nằm ngoài mọi ghi đè', () => {
    expect(resolvePricingForDate(field, '2026-08-13')).toBe(pricing);
  });
});

describe('resolvePromotion', () => {
  const promo = {
    code: 'SANG10', type: 'percentage', value: 10, slots: ['morning'],
    startDate: '2026-08-01', endDate: '2026-08-31', active: true, usedCount: 0,
  };
  const field = { ...baseField, promotions: [promo] };

  it('trả về null khi không truyền mã', () => {
    expect(resolvePromotion(field, undefined, MONDAY)).toBeNull();
  });

  it('tìm đúng mã, không phân biệt hoa thường', () => {
    expect(resolvePromotion(field, 'sang10', MONDAY)).toBe(promo);
  });

  it('ném lỗi khi mã không tồn tại', () => {
    expect(() => resolvePromotion(field, 'KHONGCO', MONDAY)).toThrow('Invalid or expired promo code');
  });

  it('ném lỗi khi mã đã hết hạn', () => {
    expect(() => resolvePromotion(field, 'SANG10', '2026-09-01')).toThrow();
  });

  it('ném lỗi khi mã đang tắt', () => {
    const inactive = { ...baseField, promotions: [{ ...promo, active: false }] };
    expect(() => resolvePromotion(inactive, 'SANG10', MONDAY)).toThrow();
  });

  it('ném lỗi khi đã dùng hết lượt', () => {
    const exhausted = { ...baseField, promotions: [{ ...promo, maxUses: 1, usedCount: 1 }] };
    expect(() => resolvePromotion(exhausted, 'SANG10', MONDAY)).toThrow();
  });
});

describe('calcBookingPrice', () => {
  it('không có mã khuyến mãi → giá gốc, discount = 0', () => {
    const result = calcBookingPrice(baseField, MONDAY, '19:00', '21:00');
    expect(result).toEqual({ totalPrice: 600000, basePrice: 600000, discount: 0, promoCode: null });
  });

  it('khuyến mãi percentage áp toàn bộ khung khi không giới hạn slots', () => {
    const field = {
      ...baseField,
      promotions: [{ code: 'ALL10', type: 'percentage', value: 10, slots: [], startDate: '2026-08-01', endDate: '2026-08-31', active: true, usedCount: 0 }],
    };
    // 17:00-20:00 = 800000, giảm 10% = 80000
    const result = calcBookingPrice(field, MONDAY, '17:00', '20:00', 'ALL10');
    expect(result).toEqual({ totalPrice: 720000, basePrice: 800000, discount: 80000, promoCode: 'ALL10' });
  });

  it('khuyến mãi giới hạn theo khung giờ chỉ trừ trên phần tiền của khung đó', () => {
    const field = {
      ...baseField,
      promotions: [{ code: 'CHIEU50', type: 'percentage', value: 50, slots: ['afternoon'], startDate: '2026-08-01', endDate: '2026-08-31', active: true, usedCount: 0 }],
    };
    // 17:00-20:00 = 200000 chiều + 600000 tối; giảm 50% của riêng phần chiều = 100000
    const result = calcBookingPrice(field, MONDAY, '17:00', '20:00', 'CHIEU50');
    expect(result).toEqual({ totalPrice: 700000, basePrice: 800000, discount: 100000, promoCode: 'CHIEU50' });
  });

  it('khuyến mãi fixed bị giới hạn không vượt quá phần tiền của khung áp dụng', () => {
    const field = {
      ...baseField,
      promotions: [{ code: 'GIAM50K', type: 'fixed', value: 500000, slots: ['morning'], startDate: '2026-08-01', endDate: '2026-08-31', active: true, usedCount: 0 }],
    };
    // Không có phút nào trong khung sáng ở khoảng 19:00-21:00 → discountBase = 0 → discount = 0
    const result = calcBookingPrice(field, MONDAY, '19:00', '21:00', 'GIAM50K');
    expect(result).toEqual({ totalPrice: 600000, basePrice: 600000, discount: 0, promoCode: 'GIAM50K' });
  });

  it('mã khuyến mãi không hợp lệ ném lỗi thay vì âm thầm bỏ qua', () => {
    expect(() => calcBookingPrice(baseField, MONDAY, '19:00', '21:00', 'SAI')).toThrow('Invalid or expired promo code');
  });

  it('dùng giá ghi đè theo ngày trước khi tính khuyến mãi', () => {
    const field = {
      pricing,
      priceOverrides: [{ name: 'Tết', startDate: MONDAY, endDate: MONDAY, weekday: holidayPricing.weekday, weekend: holidayPricing.weekend }],
      promotions: [],
    };
    // Giá ghi đè: evening = 600000 thay vì 300000 gốc → 2h = 1200000
    const result = calcBookingPrice(field, MONDAY, '19:00', '21:00');
    expect(result.basePrice).toBe(1200000);
  });
});
