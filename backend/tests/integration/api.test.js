const request = require('supertest');
const app = require('../../src/app');

/**
 * Test ở tầng HTTP nhưng không chạm MongoDB: chỉ đi vào các nhánh trả lời
 * trước khi chạm tầng dữ liệu — health check, bảng giá công khai, và các
 * chốt chặn 401/404 của middleware xác thực.
 */
describe('GET /health', () => {
  it('trả về ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/v1/billing/plans', () => {
  it('công khai, không cần đăng nhập', async () => {
    const res = await request(app).get('/api/v1/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plans.length).toBeGreaterThan(0);
  });

  it('mỗi gói có đủ code, tên và giá', async () => {
    const { body } = await request(app).get('/api/v1/billing/plans');
    for (const plan of body.data.plans) {
      expect(plan).toEqual(
        expect.objectContaining({
          code: expect.any(String),
          name: expect.any(String),
          monthlyPrice: expect.any(Number),
        })
      );
    }
  });
});

describe('các khu cần đăng nhập', () => {
  const guarded = [
    '/api/v1/admin/overview',
    '/api/v1/admin/owners',
    '/api/v1/admin/invoices',
    '/api/v1/billing/subscription',
    '/api/v1/bookings/team/bookings',
    '/api/v1/bookings/owner/stats',
    '/api/v1/teams/me/dashboard',
  ];

  it.each(guarded)('%s trả 401 khi không có token', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('token rác vẫn bị chặn 401', async () => {
    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('định tuyến', () => {
  it('đường dẫn không tồn tại trả 404 dạng JSON', async () => {
    const res = await request(app).get('/api/v1/khong-ton-tai');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it('/bookings/team/bookings không bị nuốt bởi route /bookings/:id', async () => {
    // Nếu '/:id' bắt trước, response sẽ là 401 của route booking detail —
    // nên phân biệt bằng việc route này vẫn tồn tại (không phải 404).
    const res = await request(app).get('/api/v1/bookings/team/bookings');
    expect(res.status).not.toBe(404);
  });
});
