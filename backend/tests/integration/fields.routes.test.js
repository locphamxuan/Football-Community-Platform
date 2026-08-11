jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/field.service');

const request = require('supertest');
const app = require('../../src/app');
const fieldService = require('../../src/services/field.service');
const { asUser, asOwner, asAdmin, USER_ID } = require('../helpers/auth');

const FIELD_ID = '000000000000000000000010';
const SUB_FIELD_ID = '000000000000000000000011';

/** Sân hợp lệ tối thiểu, gửi qua multipart giống form thật của web. */
const attachValidField = (req) => req
  .field('name', 'Sân Probe')
  .field('location', JSON.stringify({ address: '1 Đường Test', city: 'Hà Nội', district: 'Cầu Giấy' }))
  .field('pricing', JSON.stringify({
    weekday: { morning: 100000, afternoon: 200000, evening: 300000 },
    weekend: { morning: 150000, afternoon: 250000, evening: 400000 },
  }));

describe('các endpoint công khai', () => {
  it('GET /fields không cần đăng nhập', async () => {
    fieldService.getFields.mockResolvedValue({ fields: [], total: 0, page: 1, limit: 10 });

    const res = await request(app).get('/api/v1/fields');

    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toMatchObject({ total: 0, page: 1, limit: 10 });
  });

  it('GET /fields/:id không cần đăng nhập', async () => {
    fieldService.getFieldById.mockResolvedValue({ _id: FIELD_ID, name: 'Sân Probe' });

    const res = await request(app).get(`/api/v1/fields/${FIELD_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.field.name).toBe('Sân Probe');
  });
});

describe('GET /fields/:id/availability', () => {
  it('trả danh sách sân con còn trống', async () => {
    fieldService.checkAvailability.mockResolvedValue([{ subFieldId: SUB_FIELD_ID, isAvailable: true }]);

    const res = await request(app)
      .get(`/api/v1/fields/${FIELD_ID}/availability`)
      .query({ date: '2026-09-01', startTime: '18:00', endTime: '20:00' });

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toHaveLength(1);
  });

  it.each([
    ['thiếu ngày', { startTime: '18:00', endTime: '20:00' }],
    ['ngày sai định dạng', { date: '01-09-2026', startTime: '18:00', endTime: '20:00' }],
    ['giờ sai định dạng', { date: '2026-09-01', startTime: '6pm', endTime: '20:00' }],
    ['loại sân không hợp lệ', { date: '2026-09-01', startTime: '18:00', endTime: '20:00', fieldType: '9v9' }],
  ])('từ chối khi %s', async (_label, query) => {
    const res = await request(app).get(`/api/v1/fields/${FIELD_ID}/availability`).query(query);

    expect(res.status).toBe(400);
    expect(fieldService.checkAvailability).not.toHaveBeenCalled();
  });
});

describe('phân quyền chủ sân', () => {
  it('GET /fields/owner/my-fields từ chối người dùng thường', async () => {
    const res = await request(app).get('/api/v1/fields/owner/my-fields').set(asUser());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /fields/owner/my-fields cho chủ sân đi qua', async () => {
    fieldService.getMyFields.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/fields/owner/my-fields').set(asOwner());

    expect(res.status).toBe(200);
    expect(fieldService.getMyFields).toHaveBeenCalledWith(USER_ID);
  });

  it('admin không tạo sân thay chủ sân được', async () => {
    const res = await request(app).post('/api/v1/fields').set(asAdmin()).field('name', 'Sân Probe');

    expect(res.status).toBe(403);
  });
});

describe('POST /fields', () => {
  it('giải mã field JSON trong multipart rồi tạo sân', async () => {
    fieldService.createField.mockResolvedValue({ _id: FIELD_ID, name: 'Sân Probe' });

    const res = await attachValidField(request(app).post('/api/v1/fields').set(asOwner()));

    expect(res.status).toBe(201);
    expect(fieldService.createField).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        name: 'Sân Probe',
        location: expect.objectContaining({ city: 'Hà Nội' }),
        pricing: expect.objectContaining({ weekday: expect.objectContaining({ evening: 300000 }) }),
      }),
      []
    );
  });

  it('báo lỗi khi field JSON không parse được', async () => {
    const res = await request(app)
      .post('/api/v1/fields')
      .set(asOwner())
      .field('name', 'Sân Probe')
      .field('location', '{khong-phai-json');

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('location');
    expect(fieldService.createField).not.toHaveBeenCalled();
  });

  it('thiếu bảng giá thì không tạo được', async () => {
    const res = await request(app)
      .post('/api/v1/fields')
      .set(asOwner())
      .field('name', 'Sân Probe')
      .field('location', JSON.stringify({ address: '1 Đường Test', city: 'Hà Nội', district: 'Cầu Giấy' }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('pricing');
  });
});

describe('PATCH /fields/:id', () => {
  it('chủ sân sửa được sân', async () => {
    fieldService.updateField.mockResolvedValue({ _id: FIELD_ID, status: 'inactive' });

    const res = await request(app)
      .patch(`/api/v1/fields/${FIELD_ID}`)
      .set(asOwner())
      .field('status', 'inactive');

    expect(res.status).toBe(200);
    expect(fieldService.updateField).toHaveBeenCalledWith(
      FIELD_ID, USER_ID, expect.objectContaining({ status: 'inactive' }), [], false
    );
  });

  it('chủ sân không tự đẩy sân sang trạng thái chờ duyệt', async () => {
    const res = await request(app)
      .patch(`/api/v1/fields/${FIELD_ID}`)
      .set(asOwner())
      .field('status', 'pending_approval');

    expect(res.status).toBe(400);
    expect(fieldService.updateField).not.toHaveBeenCalled();
  });

  it('admin sửa sân được và service biết đó là admin', async () => {
    fieldService.updateField.mockResolvedValue({ _id: FIELD_ID });

    await request(app).patch(`/api/v1/fields/${FIELD_ID}`).set(asAdmin()).field('name', 'Tên mới');

    expect(fieldService.updateField).toHaveBeenCalledWith(
      FIELD_ID, USER_ID, expect.any(Object), [], true
    );
  });
});

describe('sân con', () => {
  it('thêm sân con hợp lệ', async () => {
    fieldService.addSubField.mockResolvedValue({ _id: FIELD_ID });

    const res = await request(app)
      .post(`/api/v1/fields/${FIELD_ID}/sub-fields`)
      .set(asOwner())
      .send({ name: 'Sân A', fieldType: '5v5', capacity: 10 });

    expect(res.status).toBe(201);
    expect(fieldService.addSubField).toHaveBeenCalledWith(FIELD_ID, USER_ID, expect.objectContaining({ name: 'Sân A' }));
  });

  it.each([
    ['loại sân lạ', { name: 'Sân A', fieldType: '9v9', capacity: 10 }],
    ['sức chứa dưới 6', { name: 'Sân A', fieldType: '5v5', capacity: 4 }],
    ['sức chứa trên 22', { name: 'Sân A', fieldType: '11v11', capacity: 30 }],
  ])('từ chối khi %s', async (_label, body) => {
    const res = await request(app).post(`/api/v1/fields/${FIELD_ID}/sub-fields`).set(asOwner()).send(body);

    expect(res.status).toBe(400);
    expect(fieldService.addSubField).not.toHaveBeenCalled();
  });

  it('sửa trạng thái sân con', async () => {
    fieldService.updateSubField.mockResolvedValue({ _id: FIELD_ID });

    const res = await request(app)
      .patch(`/api/v1/fields/${FIELD_ID}/sub-fields/${SUB_FIELD_ID}`)
      .set(asOwner())
      .send({ status: 'maintenance' });

    expect(res.status).toBe(200);
    expect(fieldService.updateSubField).toHaveBeenCalledWith(
      FIELD_ID, SUB_FIELD_ID, USER_ID, { status: 'maintenance' }
    );
  });

  it('xoá sân con', async () => {
    fieldService.deleteSubField.mockResolvedValue({ _id: FIELD_ID });

    const res = await request(app)
      .delete(`/api/v1/fields/${FIELD_ID}/sub-fields/${SUB_FIELD_ID}`)
      .set(asOwner());

    expect(res.status).toBe(200);
  });
});

describe('duyệt sân', () => {
  it('chủ sân gửi sân đi duyệt', async () => {
    fieldService.submitForApproval.mockResolvedValue({ status: 'pending_approval' });

    const res = await request(app).patch(`/api/v1/fields/${FIELD_ID}/submit`).set(asOwner());

    expect(res.status).toBe(200);
    expect(fieldService.submitForApproval).toHaveBeenCalledWith(FIELD_ID, USER_ID);
  });

  it('chỉ admin được duyệt', async () => {
    const res = await request(app).patch(`/api/v1/fields/${FIELD_ID}/verify`).set(asOwner()).send({ approve: true });

    expect(res.status).toBe(403);
    expect(fieldService.verifyField).not.toHaveBeenCalled();
  });

  it('admin duyệt sân', async () => {
    fieldService.verifyField.mockResolvedValue({ isVerified: true });

    const res = await request(app)
      .patch(`/api/v1/fields/${FIELD_ID}/verify`)
      .set(asAdmin())
      .send({ approve: true, note: 'Hồ sơ đủ' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Field approved');
    expect(fieldService.verifyField).toHaveBeenCalledWith(FIELD_ID, { approve: true, note: 'Hồ sơ đủ' });
  });

  it('admin từ chối sân, mặc định approve là true nên phải gửi false tường minh', async () => {
    fieldService.verifyField.mockResolvedValue({ isVerified: false });

    const res = await request(app)
      .patch(`/api/v1/fields/${FIELD_ID}/verify`)
      .set(asAdmin())
      .send({ approve: false, note: 'Thiếu ảnh' });

    expect(res.body.message).toBe('Field rejected');
    expect(fieldService.verifyField).toHaveBeenCalledWith(FIELD_ID, { approve: false, note: 'Thiếu ảnh' });
  });
});

describe('DELETE /fields/:id', () => {
  it('người dùng thường không xoá được sân', async () => {
    const res = await request(app).delete(`/api/v1/fields/${FIELD_ID}`).set(asUser());
    expect(res.status).toBe(403);
  });

  it('chủ sân xoá được sân của mình', async () => {
    fieldService.deleteField.mockResolvedValue(undefined);

    const res = await request(app).delete(`/api/v1/fields/${FIELD_ID}`).set(asOwner());

    expect(res.status).toBe(200);
    expect(fieldService.deleteField).toHaveBeenCalledWith(FIELD_ID, USER_ID, false);
  });
});
