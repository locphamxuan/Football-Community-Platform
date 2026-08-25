jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/models/Field', () => ({ findById: jest.fn() }));

const Field = require('../../src/models/Field');
const fieldPricingService = require('../../src/services/fieldPricing.service');
const { resetCache } = require('../helpers/fakeRedis');

const OWNER_ID = '000000000000000000000002';
const OTHER_OWNER_ID = '000000000000000000000003';
const FIELD_ID = '000000000000000000000010';

/**
 * Mảng sub-document giả mang `.id()` như mongoose thật — `push` dùng thẳng bản gốc của
 * Array.prototype (đã hoạt động đúng trên `this`), chỉ cần thêm `.id()` mà mongoose có.
 */
const arrayLike = (items) => Object.assign([...items], {
  id(wanted) { return this.find((i) => i._id === wanted) || null; },
});

const fakeField = ({ priceOverrides, promotions, ...overrides } = {}) => ({
  _id: FIELD_ID,
  owner: { toString: () => OWNER_ID },
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
  priceOverrides: arrayLike(priceOverrides ?? []),
  promotions: arrayLike(promotions ?? []),
});

beforeEach(() => {
  resetCache();
});

describe('addPriceOverride', () => {
  it('chủ sân khác không thêm được', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await expect(
      fieldPricingService.addPriceOverride(FIELD_ID, OTHER_OWNER_ID, { name: 'Tết' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('admin thêm được thay chủ sân', async () => {
    const field = fakeField();
    Field.findById.mockResolvedValue(field);

    await fieldPricingService.addPriceOverride(FIELD_ID, 'admin-id', { name: 'Tết' }, true);

    expect(field.priceOverrides).toHaveLength(1);
    expect(field.save).toHaveBeenCalled();
  });
});

describe('deletePriceOverride', () => {
  it('ghi đè không tồn tại trả 404', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await expect(
      fieldPricingService.deletePriceOverride(FIELD_ID, 'khong-co', OWNER_ID)
    ).rejects.toMatchObject({ code: 'PRICE_OVERRIDE_NOT_FOUND' });
  });

  it('xoá đúng phần tử theo id', async () => {
    const override = { _id: 'ov1', deleteOne: jest.fn() };
    const field = fakeField({ priceOverrides: [override] });
    Field.findById.mockResolvedValue(field);

    await fieldPricingService.deletePriceOverride(FIELD_ID, 'ov1', OWNER_ID);

    expect(override.deleteOne).toHaveBeenCalled();
  });
});

describe('addPromotion', () => {
  it('chặn tạo mã trùng còn hiệu lực', async () => {
    const field = fakeField({ promotions: [{ code: 'SALE10', active: true }] });
    Field.findById.mockResolvedValue(field);

    await expect(
      fieldPricingService.addPromotion(FIELD_ID, OWNER_ID, { code: 'sale10', type: 'percentage', value: 10 })
    ).rejects.toMatchObject({ code: 'DUPLICATE_PROMO_CODE' });
  });

  it('cho phép tạo lại mã đã tắt active', async () => {
    const field = fakeField({ promotions: [{ code: 'SALE10', active: false }] });
    Field.findById.mockResolvedValue(field);

    await fieldPricingService.addPromotion(FIELD_ID, OWNER_ID, { code: 'SALE10', type: 'percentage', value: 10 });

    expect(field.promotions).toHaveLength(2);
  });

  it('chuẩn hoá mã về chữ hoa', async () => {
    const field = fakeField();
    Field.findById.mockResolvedValue(field);

    await fieldPricingService.addPromotion(FIELD_ID, OWNER_ID, { code: ' sale20 ', type: 'fixed', value: 50000 });

    expect(field.promotions[0].code).toBe('SALE20');
  });
});

describe('updatePromotion', () => {
  it('mã không tồn tại trả 404', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await expect(
      fieldPricingService.updatePromotion(FIELD_ID, 'khong-co', OWNER_ID, { active: false })
    ).rejects.toMatchObject({ code: 'PROMOTION_NOT_FOUND' });
  });

  it('bật/tắt active đúng phần tử', async () => {
    const promo = { _id: 'p1', code: 'SALE10', active: true };
    const field = fakeField({ promotions: [promo] });
    Field.findById.mockResolvedValue(field);

    await fieldPricingService.updatePromotion(FIELD_ID, 'p1', OWNER_ID, { active: false });

    expect(promo.active).toBe(false);
  });
});

describe('deletePromotion', () => {
  it('xoá đúng phần tử theo id', async () => {
    const promo = { _id: 'p1', deleteOne: jest.fn() };
    const field = fakeField({ promotions: [promo] });
    Field.findById.mockResolvedValue(field);

    await fieldPricingService.deletePromotion(FIELD_ID, 'p1', OWNER_ID);

    expect(promo.deleteOne).toHaveBeenCalled();
  });
});
