jest.mock('../../src/models/User', () => ({
  findById: jest.fn(), findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../src/models/Field', () => ({ countDocuments: jest.fn() }));
jest.mock('../../src/services/billing.service', () => ({
  ensureSubscription: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../src/services/adminAuditLog.service');

const User = require('../../src/models/User');
const Field = require('../../src/models/Field');
const billingService = require('../../src/services/billing.service');
const adminAuditLogService = require('../../src/services/adminAuditLog.service');
const adminService = require('../../src/services/admin.service');
const { AdminAction, AdminTargetType } = require('../../src/constants/adminAudit');

const ADMIN_ID = '000000000000000000000001';
const USER_ID = '000000000000000000000002';

const fakeUser = (overrides = {}) => ({
  _id: USER_ID,
  roles: ['user'],
  status: 'active',
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  Field.countDocuments.mockResolvedValue(0);
});

describe('updateUserRoles', () => {
  it('cấp thêm role và ghi log kèm role cũ/mới', async () => {
    const user = fakeUser({ roles: ['user'] });
    User.findById.mockResolvedValue(user);

    const result = await adminService.updateUserRoles(USER_ID, ['user', 'field_owner'], ADMIN_ID);

    expect(result.roles).toEqual(['user', 'field_owner']);
    expect(billingService.ensureSubscription).toHaveBeenCalledWith(USER_ID);
    expect(adminAuditLogService.record).toHaveBeenCalledWith(
      ADMIN_ID, AdminAction.USER_ROLES_UPDATED, AdminTargetType.USER, USER_ID,
      { from: ['user'], to: ['user', 'field_owner'] }
    );
  });

  it('admin không tự gỡ quyền admin của chính mình', async () => {
    User.findById.mockResolvedValue(fakeUser({ roles: ['user', 'admin'] }));

    await expect(adminService.updateUserRoles(ADMIN_ID, ['user'], ADMIN_ID))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(adminAuditLogService.record).not.toHaveBeenCalled();
  });

  it('không gỡ quyền chủ sân khi còn sân đang hoạt động', async () => {
    User.findById.mockResolvedValue(fakeUser({ roles: ['user', 'field_owner'] }));
    Field.countDocuments.mockResolvedValue(2);

    await expect(adminService.updateUserRoles(USER_ID, ['user'], ADMIN_ID))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(adminAuditLogService.record).not.toHaveBeenCalled();
  });

  it('user không tồn tại trả 404', async () => {
    User.findById.mockResolvedValue(null);

    await expect(adminService.updateUserRoles(USER_ID, ['user'], ADMIN_ID))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('updateUserStatus', () => {
  const mockPreviousStatus = (status) =>
    User.findById.mockReturnValue({ select: () => Promise.resolve(status === null ? null : { status }) });

  it('cấm tài khoản và ghi log kèm trạng thái cũ/mới', async () => {
    mockPreviousStatus('active');
    User.findByIdAndUpdate.mockResolvedValue(fakeUser({ status: 'banned' }));

    const result = await adminService.updateUserStatus(USER_ID, 'banned', ADMIN_ID);

    expect(result.status).toBe('banned');
    expect(adminAuditLogService.record).toHaveBeenCalledWith(
      ADMIN_ID, AdminAction.USER_STATUS_UPDATED, AdminTargetType.USER, USER_ID,
      { from: 'active', to: 'banned' }
    );
  });

  it('admin không tự cấm chính mình', async () => {
    await expect(adminService.updateUserStatus(ADMIN_ID, 'banned', ADMIN_ID))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(adminAuditLogService.record).not.toHaveBeenCalled();
  });

  it('user không tồn tại trả 404', async () => {
    mockPreviousStatus(null);

    await expect(adminService.updateUserStatus(USER_ID, 'banned', ADMIN_ID))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
