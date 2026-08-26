jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/fieldPricing.service');
jest.mock('../../src/services/booking');

const request = require('supertest');
const app = require('../../src/app');
const fieldPricingService = require('../../src/services/fieldPricing.service');
const bookingService = require('../../src/services/booking');
const { asUser, asOwner, USER_ID } = require('../helpers/auth');

const FIELD_ID = '000000000000000000000010';
const OVERRIDE_ID = '000000000000000000000050';
const PROMO_ID = '000000000000000000000060';

const validOverride = {
  name: 'Tết Dương lịch',
  startDate: '2027-01-01',
  endDate: '2027-01-02',
  weekday: { morning: 100000, afternoon: 200000, evening: 300000 },
  weekend: { morning: 150000, afternoon: 250000, evening: 400000 },
};

const validPromotion = {
  code: 'SALE10',
  type: 'percentage',
  value: 10,
  startDate: '2027-01-01',
  endDate: '2027-01-31',
};

describe('các endpoint cần đăng nhập', () => {
  it.each([
    ['post', `/api/v1/fields/${FIELD_ID}/price-overrides`],
    ['delete', `/api/v1/fields/${FIELD_ID}/price-overrides/${OVERRIDE_ID}`],
    ['post', `/api/v1/fields/${FIELD_ID}/promotions`],
    ['patch', `/api/v1/fields/${FIELD_ID}/promotions/${PROMO_ID}`],
    ['delete', `/api/v1/fields/${FIELD_ID}/promotions/${PROMO_ID}`],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});

describe('chỉ chủ sân mới quản lý giá/khuyến mãi', () => {
  it.each([
    ['post', `/api/v1/fields/${FIELD_ID}/price-overrides`, validOverride],
    ['post', `/api/v1/fields/${FIELD_ID}/promotions`, validPromotion],
  ])('%s %s trả 403 cho người dùng thường', async (method, url, body) => {
    const res = await request(app)[method](url).set(asUser()).send(body);
    expect(res.status).toBe(403);
  });
});

describe('GET /fields/:id/price-quote', () => {
  it('không cần đăng nhập', async () => {
    bookingService.previewBookingPrice.mockResolvedValue({ totalPrice: 100000, basePrice: 100000, discount: 0, promoCode: null });

    const res = await request(app)
      .get(`/api/v1/fields/${FIELD_ID}/price-quote`)
      .query({ date: '2027-01-05', startTime: '18:00', endTime: '20:00' });

    expect(res.status).toBe(200);
    expect(res.body.data.totalPrice).toBe(100000);
    expect(bookingService.previewBookingPrice).toHaveBeenCalledWith(FIELD_ID, '2027-01-05', '18:00', '20:00', undefined);
  });

  it('thiếu date thì báo 400', async () => {
    const res = await request(app)
      .get(`/api/v1/fields/${FIELD_ID}/price-quote`)
      .query({ startTime: '18:00', endTime: '20:00' });

    expect(res.status).toBe(400);
    expect(bookingService.previewBookingPrice).not.toHaveBeenCalled();
  });
});

describe('POST /fields/:id/price-overrides', () => {
  it('tạo ghi đè hợp lệ', async () => {
    fieldPricingService.addPriceOverride.mockResolvedValue({ _id: FIELD_ID });

    const res = await request(app)
      .post(`/api/v1/fields/${FIELD_ID}/price-overrides`)
      .set(asOwner())
      .send(validOverride);

    expect(res.status).toBe(201);
    expect(fieldPricingService.addPriceOverride).toHaveBeenCalledWith(
      FIELD_ID, USER_ID, expect.objectContaining({ name: 'Tết Dương lịch' }), false
    );
  });

  it('endDate trước startDate thì bị từ chối', async () => {
    const res = await request(app)
      .post(`/api/v1/fields/${FIELD_ID}/price-overrides`)
      .set(asOwner())
      .send({ ...validOverride, startDate: '2027-01-10', endDate: '2027-01-01' });

    expect(res.status).toBe(400);
    expect(fieldPricingService.addPriceOverride).not.toHaveBeenCalled();
  });
});

describe('DELETE /fields/:id/price-overrides/:overrideId', () => {
  it('xoá ghi đè', async () => {
    fieldPricingService.deletePriceOverride.mockResolvedValue({ _id: FIELD_ID });

    const res = await request(app)
      .delete(`/api/v1/fields/${FIELD_ID}/price-overrides/${OVERRIDE_ID}`)
      .set(asOwner());

    expect(res.status).toBe(200);
    expect(fieldPricingService.deletePriceOverride).toHaveBeenCalledWith(FIELD_ID, OVERRIDE_ID, USER_ID, false);
  });
});

describe('POST /fields/:id/promotions', () => {
  it('tạo mã khuyến mãi hợp lệ', async () => {
    fieldPricingService.addPromotion.mockResolvedValue({ _id: FIELD_ID });

    const res = await request(app)
      .post(`/api/v1/fields/${FIELD_ID}/promotions`)
      .set(asOwner())
      .send(validPromotion);

    expect(res.status).toBe(201);
    expect(fieldPricingService.addPromotion).toHaveBeenCalledWith(
      FIELD_ID, USER_ID, expect.objectContaining({ code: 'SALE10' }), false
    );
  });

  it('percentage vượt quá 100 thì bị từ chối', async () => {
    const res = await request(app)
      .post(`/api/v1/fields/${FIELD_ID}/promotions`)
      .set(asOwner())
      .send({ ...validPromotion, value: 150 });

    expect(res.status).toBe(400);
    expect(fieldPricingService.addPromotion).not.toHaveBeenCalled();
  });

  it('thiếu type thì bị từ chối', async () => {
    const { type, ...body } = validPromotion;
    const res = await request(app).post(`/api/v1/fields/${FIELD_ID}/promotions`).set(asOwner()).send(body);

    expect(res.status).toBe(400);
    expect(fieldPricingService.addPromotion).not.toHaveBeenCalled();
  });
});

describe('PATCH /fields/:id/promotions/:promoId', () => {
  it('bật/tắt mã khuyến mãi', async () => {
    fieldPricingService.updatePromotion.mockResolvedValue({ _id: FIELD_ID });

    const res = await request(app)
      .patch(`/api/v1/fields/${FIELD_ID}/promotions/${PROMO_ID}`)
      .set(asOwner())
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(fieldPricingService.updatePromotion).toHaveBeenCalledWith(
      FIELD_ID, PROMO_ID, USER_ID, { active: false }, false
    );
  });
});

describe('DELETE /fields/:id/promotions/:promoId', () => {
  it('xoá mã khuyến mãi', async () => {
    fieldPricingService.deletePromotion.mockResolvedValue({ _id: FIELD_ID });

    const res = await request(app)
      .delete(`/api/v1/fields/${FIELD_ID}/promotions/${PROMO_ID}`)
      .set(asOwner());

    expect(res.status).toBe(200);
    expect(fieldPricingService.deletePromotion).toHaveBeenCalledWith(FIELD_ID, PROMO_ID, USER_ID, false);
  });
});
