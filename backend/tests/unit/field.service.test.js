jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/models/Field', () => ({
  findById: jest.fn(), find: jest.fn(), exists: jest.fn(),
  findByIdAndUpdate: jest.fn(), create: jest.fn(), countDocuments: jest.fn(),
}));
jest.mock('../../src/models/Booking', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../src/services/billing.service', () => ({
  assertCanCreateField: jest.fn().mockResolvedValue({}),
  assertCanAddSubField: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../src/config/cloudinary', () => ({
  uploadMultipleImages: jest.fn().mockResolvedValue([{ url: 'https://cdn/san.jpg' }]),
  deleteImage: jest.fn().mockResolvedValue(undefined),
}));

const Field = require('../../src/models/Field');
const Booking = require('../../src/models/Booking');
const billingService = require('../../src/services/billing.service');
const fieldService = require('../../src/services/field.service');
const { cache, CacheKeys, resetCache } = require('../helpers/fakeRedis');
const { AppError } = require('../../src/middleware/errorHandler');

const OWNER_ID = '000000000000000000000002';
const FIELD_ID = '000000000000000000000010';
const SUB_FIELD_ID = '000000000000000000000011';

const validFieldData = {
  name: 'Sân Probe',
  location: { address: '1 Đường Test', city: 'Hà Nội', district: 'Cầu Giấy' },
  pricing: { weekday: { morning: 1, afternoon: 2, evening: 3 }, weekend: { morning: 1, afternoon: 2, evening: 3 } },
};

const subField = (id, overrides = {}) => ({
  _id: { toString: () => id },
  name: 'Sân A',
  fieldType: '5v5',
  status: 'available',
  ...overrides,
});

const fakeField = (overrides = {}) => {
  const subFields = overrides.subFields ?? [subField(SUB_FIELD_ID)];
  return {
    _id: FIELD_ID,
    name: 'Sân Probe',
    status: 'active',
    isVerified: true,
    images: [],
    owner: { toString: () => OWNER_ID },
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides,
    subFields: Object.assign(subFields, {
      id: (wanted) => subFields.find((s) => s._id.toString() === wanted) || null,
    }),
  };
};

/** Booking.find(...).select(...).lean() dùng ở checkAvailability. */
const bookingsFound = (rows) => Booking.find.mockReturnValue({
  select: () => ({ lean: () => Promise.resolve(rows) }),
});

beforeEach(() => {
  resetCache();
  Field.exists.mockResolvedValue(null);
  Field.findByIdAndUpdate.mockResolvedValue({});
  Booking.countDocuments.mockResolvedValue(0);
  bookingsFound([]);
});

describe('createField', () => {
  it('kiểm tra hạn mức gói trước khi tạo', async () => {
    Field.create.mockResolvedValue({ _id: FIELD_ID });

    await fieldService.createField(OWNER_ID, validFieldData);

    expect(billingService.assertCanCreateField).toHaveBeenCalledWith(OWNER_ID);
  });

  it('hết hạn mức thì không chạm tới cơ sở dữ liệu', async () => {
    billingService.assertCanCreateField.mockRejectedValueOnce(
      new AppError('Plan limit', 402, 'PLAN_LIMIT_REACHED')
    );

    await expect(fieldService.createField(OWNER_ID, validFieldData))
      .rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
    expect(Field.create).not.toHaveBeenCalled();
  });

  it('lưu toạ độ theo thứ tự [lng, lat] của GeoJSON', async () => {
    Field.create.mockResolvedValue({ _id: FIELD_ID });

    await fieldService.createField(OWNER_ID, {
      ...validFieldData,
      location: { ...validFieldData.location, coordinates: { lat: 21.03, lng: 105.85 } },
    });

    expect(Field.create).toHaveBeenCalledWith(expect.objectContaining({
      location: expect.objectContaining({ coordinates: { type: 'Point', coordinates: [105.85, 21.03] } }),
    }));
  });

  it('không có toạ độ thì mặc định [0, 0] để index 2dsphere không vỡ', async () => {
    Field.create.mockResolvedValue({ _id: FIELD_ID });

    await fieldService.createField(OWNER_ID, validFieldData);

    expect(Field.create).toHaveBeenCalledWith(expect.objectContaining({
      location: expect.objectContaining({ coordinates: { type: 'Point', coordinates: [0, 0] } }),
    }));
  });
});

describe('updateField', () => {
  it('chủ sân khác không sửa được', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await expect(fieldService.updateField(FIELD_ID, 'chu-san-khac', { name: 'Tên mới' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('sân chưa được duyệt thì chủ sân không tự bật nhận đặt', async () => {
    Field.findById.mockResolvedValue(fakeField({ isVerified: false }));

    await expect(fieldService.updateField(FIELD_ID, OWNER_ID, { status: 'active' }))
      .rejects.toMatchObject({ code: 'FIELD_NOT_ACTIVE' });
  });

  it('admin bật được sân chưa duyệt', async () => {
    Field.findById.mockResolvedValue(fakeField({ isVerified: false }));

    await expect(fieldService.updateField(FIELD_ID, OWNER_ID, { status: 'active' }, [], true))
      .resolves.toBeDefined();
  });

  it('gỡ ảnh khỏi danh sách và giữ lại ảnh còn dùng', async () => {
    Field.findById.mockResolvedValue(fakeField({ images: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] }));

    await fieldService.updateField(FIELD_ID, OWNER_ID, { removeImages: ['https://cdn/a.jpg'] });

    expect(Field.findByIdAndUpdate).toHaveBeenCalledWith(
      FIELD_ID, expect.objectContaining({ images: ['https://cdn/b.jpg'] }), { new: true }
    );
  });

  it('xoá cache của sân sau khi sửa', async () => {
    Field.findById.mockResolvedValue(fakeField());
    await cache.set(CacheKeys.field(FIELD_ID), 'du-lieu-cu');

    await fieldService.updateField(FIELD_ID, OWNER_ID, { name: 'Tên mới' });

    expect(await cache.exists(CacheKeys.field(FIELD_ID))).toBe(false);
  });
});

describe('deleteField', () => {
  it('còn lịch đặt sắp tới thì không cho xoá', async () => {
    Field.findById.mockResolvedValue(fakeField());
    Booking.countDocuments.mockResolvedValue(3);

    await expect(fieldService.deleteField(FIELD_ID, OWNER_ID))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/3 upcoming/) });
  });

  it('không còn lịch nào thì xoá được', async () => {
    const field = fakeField();
    Field.findById.mockResolvedValue(field);

    await fieldService.deleteField(FIELD_ID, OWNER_ID);

    expect(field.deleteOne).toHaveBeenCalled();
  });

  it('chỉ đếm lịch chưa kết thúc', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await fieldService.deleteField(FIELD_ID, OWNER_ID);

    expect(Booking.countDocuments).toHaveBeenCalledWith(expect.objectContaining({
      status: { $in: ['pending', 'confirmed'] },
    }));
  });
});

describe('sân con', () => {
  it('thêm sân con phải qua hạn mức gói', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await fieldService.addSubField(FIELD_ID, OWNER_ID, { name: 'Sân B', fieldType: '7v7', capacity: 14 });

    expect(billingService.assertCanAddSubField).toHaveBeenCalledWith(OWNER_ID, 1);
  });

  it('sân con mới mặc định ở trạng thái sẵn sàng', async () => {
    const field = fakeField();
    Field.findById.mockResolvedValue(field);

    await fieldService.addSubField(FIELD_ID, OWNER_ID, { name: 'Sân B', fieldType: '7v7', capacity: 14 });

    expect(field.subFields[1]).toMatchObject({ name: 'Sân B', status: 'available' });
  });

  it('không xoá sân con còn lịch — đặt "bảo trì" thay thế', async () => {
    Field.findById.mockResolvedValue(fakeField());
    Booking.countDocuments.mockResolvedValue(2);

    await expect(fieldService.deleteSubField(FIELD_ID, SUB_FIELD_ID, OWNER_ID))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/maintenance/i) });
  });

  it('sân con không tồn tại trả 404', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await expect(fieldService.updateSubField(FIELD_ID, 'khong-co', OWNER_ID, { status: 'closed' }))
      .rejects.toMatchObject({ code: 'SUBFIELD_NOT_FOUND' });
  });
});

describe('checkAvailability', () => {
  const query = { date: '2026-09-01', startTime: '18:00', endTime: '20:00' };

  it('sân chưa mở bán thì không trả lịch trống', async () => {
    Field.findById.mockResolvedValue(fakeField({ status: 'inactive' }));

    await expect(fieldService.checkAvailability(FIELD_ID, query))
      .rejects.toMatchObject({ code: 'FIELD_NOT_ACTIVE' });
  });

  it('không có lịch nào thì mọi sân con đều trống', async () => {
    Field.findById.mockResolvedValue(fakeField());

    const result = await fieldService.checkAvailability(FIELD_ID, query);

    expect(result).toEqual([expect.objectContaining({ isAvailable: true })]);
  });

  it('khung giờ chồng lấn thì báo bận', async () => {
    Field.findById.mockResolvedValue(fakeField());
    bookingsFound([{ subField: { toString: () => SUB_FIELD_ID }, startTime: '19:00', endTime: '21:00' }]);

    const [slot] = await fieldService.checkAvailability(FIELD_ID, query);

    expect(slot.isAvailable).toBe(false);
    expect(slot.bookedSlots).toEqual([{ startTime: '19:00', endTime: '21:00' }]);
  });

  it('lịch kề sát nhau không tính là chồng lấn', async () => {
    Field.findById.mockResolvedValue(fakeField());
    bookingsFound([{ subField: { toString: () => SUB_FIELD_ID }, startTime: '20:00', endTime: '22:00' }]);

    const [slot] = await fieldService.checkAvailability(FIELD_ID, query);

    expect(slot.isAvailable).toBe(true);
  });

  it('bỏ qua sân con đang bảo trì', async () => {
    Field.findById.mockResolvedValue(fakeField({
      subFields: [subField(SUB_FIELD_ID, { status: 'maintenance' })],
    }));

    const result = await fieldService.checkAvailability(FIELD_ID, query);

    expect(result).toEqual([]);
  });

  it('lọc theo loại sân khi được yêu cầu', async () => {
    Field.findById.mockResolvedValue(fakeField({
      subFields: [subField(SUB_FIELD_ID), subField('000000000000000000000012', { fieldType: '11v11' })],
    }));

    const result = await fieldService.checkAvailability(FIELD_ID, { ...query, fieldType: '11v11' });

    expect(result).toHaveLength(1);
    expect(result[0].fieldType).toBe('11v11');
  });

  it('lần gọi thứ hai lấy từ cache, không truy vấn lại', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await fieldService.checkAvailability(FIELD_ID, query);
    await fieldService.checkAvailability(FIELD_ID, query);

    expect(Booking.find).toHaveBeenCalledTimes(1);
  });
});

describe('submitForApproval', () => {
  it('sân chưa có sân con thì chưa gửi duyệt được', async () => {
    Field.findById.mockResolvedValue(fakeField({ isVerified: false, subFields: [] }));

    await expect(fieldService.submitForApproval(FIELD_ID, OWNER_ID))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('sân đã duyệt rồi thì không gửi lại', async () => {
    Field.findById.mockResolvedValue(fakeField());

    await expect(fieldService.submitForApproval(FIELD_ID, OWNER_ID))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('sân hợp lệ chuyển sang hàng chờ duyệt', async () => {
    Field.findById.mockResolvedValue(fakeField({ isVerified: false }));

    await fieldService.submitForApproval(FIELD_ID, OWNER_ID);

    expect(Field.findByIdAndUpdate).toHaveBeenCalledWith(FIELD_ID, { status: 'pending_approval' }, { new: true });
  });
});

describe('verifyField', () => {
  // verifyField populate thêm thông tin chủ sân để admin thấy ngay ai bị ảnh hưởng
  beforeEach(() => {
    Field.findByIdAndUpdate.mockReturnValue({ populate: () => Promise.resolve({ _id: FIELD_ID }) });
  });

  it('duyệt thì sân được xác thực và mở bán', async () => {
    await fieldService.verifyField(FIELD_ID, { approve: true, note: 'Đủ hồ sơ' });

    expect(Field.findByIdAndUpdate).toHaveBeenCalledWith(
      FIELD_ID,
      expect.objectContaining({ isVerified: true, status: 'active' }),
      { new: true }
    );
  });

  it('từ chối thì đưa về ngừng nhận đặt, không xoá sân', async () => {
    await fieldService.verifyField(FIELD_ID, { approve: false, note: 'Thiếu ảnh' });

    expect(Field.findByIdAndUpdate).toHaveBeenCalledWith(
      FIELD_ID,
      expect.objectContaining({ isVerified: false, status: 'inactive', moderationNote: 'Thiếu ảnh' }),
      { new: true }
    );
  });
});
