jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/admin');
jest.mock('../../src/services/billing');
jest.mock('../../src/services/user.service');
jest.mock('../../src/services/adminAuditLog.service');

const request = require('supertest');
const app = require('../../src/app');
const adminService = require('../../src/services/admin');
const billingService = require('../../src/services/billing');
const userService = require('../../src/services/user.service');
const adminAuditLogService = require('../../src/services/adminAuditLog.service');
const { asUser, asOwner, asAdmin, USER_ID } = require('../helpers/auth');

const TARGET_USER = '000000000000000000000002';
const INVOICE_ID = '000000000000000000000060';

const ADMIN_ROUTES = [
  ['get', '/api/v1/admin/overview'],
  ['get', '/api/v1/admin/revenue'],
  ['get', '/api/v1/admin/owners'],
  ['get', `/api/v1/admin/owners/${TARGET_USER}`],
  ['get', '/api/v1/admin/users'],
  ['patch', `/api/v1/admin/users/${TARGET_USER}`],
  ['get', '/api/v1/admin/fields'],
  ['get', '/api/v1/admin/invoices'],
  ['patch', `/api/v1/admin/invoices/${INVOICE_ID}/confirm`],
  ['patch', `/api/v1/admin/invoices/${INVOICE_ID}/void`],
  ['get', '/api/v1/admin/audit-log'],
];

describe('khu admin đóng với mọi vai trò khác', () => {
  it.each(ADMIN_ROUTES)('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });

  it.each(ADMIN_ROUTES)('%s %s trả 403 với người dùng thường', async (method, url) => {
    const res = await request(app)[method](url).set(asUser());
    expect(res.status).toBe(403);
  });

  it('chủ sân cũng không vào được', async () => {
    const res = await request(app).get('/api/v1/admin/overview').set(asOwner());
    expect(res.status).toBe(403);
  });
});

describe('tổng quan nền tảng', () => {
  it('GET /overview trả số liệu', async () => {
    adminService.getPlatformOverview.mockResolvedValue({ totalUsers: 10, platformRevenue: 500000 });

    const res = await request(app).get('/api/v1/admin/overview').set(asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.overview.platformRevenue).toBe(500000);
  });

  it('GET /revenue giới hạn 24 tháng', async () => {
    const res = await request(app).get('/api/v1/admin/revenue').query({ months: 99 }).set(asAdmin());

    expect(res.status).toBe(400);
    expect(adminService.getRevenueSeries).not.toHaveBeenCalled();
  });

  it('GET /revenue chấp nhận số tháng hợp lệ', async () => {
    adminService.getRevenueSeries.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/admin/revenue').query({ months: 6 }).set(asAdmin());

    expect(res.status).toBe(200);
    expect(adminService.getRevenueSeries).toHaveBeenCalledWith(6);
  });
});

describe('theo dõi chủ sân', () => {
  it('lọc theo gói thuê bao', async () => {
    adminService.getOwners.mockResolvedValue({ owners: [], total: 0, page: 1, limit: 10 });

    const res = await request(app).get('/api/v1/admin/owners').query({ plan: 'pro' }).set(asAdmin());

    expect(res.status).toBe(200);
    expect(adminService.getOwners).toHaveBeenCalledWith(expect.objectContaining({ plan: 'pro' }));
  });

  it('từ chối gói không tồn tại', async () => {
    const res = await request(app).get('/api/v1/admin/owners').query({ plan: 'enterprise' }).set(asAdmin());

    expect(res.status).toBe(400);
  });

  it('xem chi tiết một chủ sân', async () => {
    adminService.getOwnerDetail.mockResolvedValue({ owner: {}, fields: [] });

    const res = await request(app).get(`/api/v1/admin/owners/${TARGET_USER}`).set(asAdmin());

    expect(res.status).toBe(200);
    expect(adminService.getOwnerDetail).toHaveBeenCalledWith(TARGET_USER);
  });
});

describe('quản lý người dùng', () => {
  it('lọc theo vai trò và trạng thái', async () => {
    userService.getUsers.mockResolvedValue({ users: [], total: 0, page: 1, limit: 10 });

    const res = await request(app)
      .get('/api/v1/admin/users')
      .query({ role: 'field_owner', status: 'active' })
      .set(asAdmin());

    expect(res.status).toBe(200);
    expect(userService.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'field_owner', status: 'active' })
    );
  });

  it('từ chối vai trò không tồn tại', async () => {
    const res = await request(app).get('/api/v1/admin/users').query({ role: 'superadmin' }).set(asAdmin());

    expect(res.status).toBe(400);
  });

  it('khoá tài khoản', async () => {
    adminService.updateUserStatus.mockResolvedValue({ status: 'banned' });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${TARGET_USER}`)
      .set(asAdmin())
      .send({ status: 'banned' });

    expect(res.status).toBe(200);
    expect(adminService.updateUserStatus).toHaveBeenCalledWith(TARGET_USER, 'banned', USER_ID);
  });

  it('cấp thêm vai trò', async () => {
    adminService.updateUserRoles.mockResolvedValue({ roles: ['user', 'field_owner'] });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${TARGET_USER}`)
      .set(asAdmin())
      .send({ roles: ['user', 'field_owner'] });

    expect(res.status).toBe(200);
    expect(adminService.updateUserRoles).toHaveBeenCalledWith(TARGET_USER, ['user', 'field_owner'], USER_ID);
  });

  it('body rỗng bị từ chối — phải nói rõ sửa gì', async () => {
    const res = await request(app).patch(`/api/v1/admin/users/${TARGET_USER}`).set(asAdmin()).send({});

    expect(res.status).toBe(400);
    expect(adminService.updateUserStatus).not.toHaveBeenCalled();
    expect(adminService.updateUserRoles).not.toHaveBeenCalled();
  });

  it('danh sách vai trò rỗng bị từ chối', async () => {
    const res = await request(app).patch(`/api/v1/admin/users/${TARGET_USER}`).set(asAdmin()).send({ roles: [] });

    expect(res.status).toBe(400);
  });
});

describe('duyệt sân', () => {
  it('lọc sân đang chờ duyệt', async () => {
    adminService.getFieldsForModeration.mockResolvedValue({ fields: [], total: 0, page: 1, limit: 10 });

    const res = await request(app)
      .get('/api/v1/admin/fields')
      .query({ status: 'pending_approval' })
      .set(asAdmin());

    expect(res.status).toBe(200);
    expect(adminService.getFieldsForModeration).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_approval' })
    );
  });

  it('từ chối trạng thái lạ', async () => {
    const res = await request(app).get('/api/v1/admin/fields').query({ status: 'deleted' }).set(asAdmin());

    expect(res.status).toBe(400);
  });
});

describe('đối soát hoá đơn', () => {
  it('xem hoá đơn của một chủ sân', async () => {
    billingService.getInvoices.mockResolvedValue({ invoices: [], total: 0, page: 1, limit: 10 });

    const res = await request(app)
      .get('/api/v1/admin/invoices')
      .query({ ownerId: TARGET_USER, status: 'awaiting_confirmation' })
      .set(asAdmin());

    expect(res.status).toBe(200);
    expect(billingService.getInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: TARGET_USER, status: 'awaiting_confirmation' })
    );
  });

  it('xác nhận đã nhận tiền', async () => {
    billingService.confirmInvoicePayment.mockResolvedValue({ status: 'paid' });

    const res = await request(app).patch(`/api/v1/admin/invoices/${INVOICE_ID}/confirm`).set(asAdmin());

    expect(res.status).toBe(200);
    expect(billingService.confirmInvoicePayment).toHaveBeenCalledWith(INVOICE_ID, USER_ID);
  });

  it('huỷ hoá đơn kèm lý do', async () => {
    billingService.voidInvoice.mockResolvedValue({ status: 'void' });

    const res = await request(app)
      .patch(`/api/v1/admin/invoices/${INVOICE_ID}/void`)
      .set(asAdmin())
      .send({ reason: 'Phát hành nhầm' });

    expect(res.status).toBe(200);
    expect(billingService.voidInvoice).toHaveBeenCalledWith(INVOICE_ID, 'Phát hành nhầm', USER_ID);
  });

  it('lý do quá dài bị từ chối', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/invoices/${INVOICE_ID}/void`)
      .set(asAdmin())
      .send({ reason: 'x'.repeat(301) });

    expect(res.status).toBe(400);
    expect(billingService.voidInvoice).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/admin/audit-log', () => {
  it('trả nhật ký hành động admin kèm phân trang', async () => {
    adminAuditLogService.getAuditLog.mockResolvedValue({
      logs: [{ action: 'invoice.voided' }], total: 1, page: 1, limit: 10,
    });

    const res = await request(app).get('/api/v1/admin/audit-log').set(asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.logs).toHaveLength(1);
    expect(res.body.meta.pagination).toMatchObject({ total: 1, page: 1 });
  });

  it('lọc theo action hợp lệ', async () => {
    adminAuditLogService.getAuditLog.mockResolvedValue({ logs: [], total: 0, page: 1, limit: 10 });

    const res = await request(app)
      .get('/api/v1/admin/audit-log')
      .query({ action: 'user.status_updated' })
      .set(asAdmin());

    expect(res.status).toBe(200);
    expect(adminAuditLogService.getAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.status_updated' })
    );
  });

  it('action không nằm trong danh sách hợp lệ thì bị từ chối', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-log')
      .query({ action: 'not-a-real-action' })
      .set(asAdmin());

    expect(res.status).toBe(400);
    expect(adminAuditLogService.getAuditLog).not.toHaveBeenCalled();
  });
});
