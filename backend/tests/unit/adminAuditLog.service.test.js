jest.mock('../../src/models/AdminAuditLog', () => ({
  create: jest.fn(), find: jest.fn(), countDocuments: jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn() }));

const AdminAuditLog = require('../../src/models/AdminAuditLog');
const logger = require('../../src/utils/logger');
const adminAuditLogService = require('../../src/services/adminAuditLog.service');
const { AdminAction, AdminTargetType } = require('../../src/constants/adminAudit');

const ADMIN_ID = '000000000000000000000001';
const TARGET_ID = '000000000000000000000002';

describe('record', () => {
  it('ghi một dòng nhật ký với đủ admin/action/target/details', async () => {
    AdminAuditLog.create.mockResolvedValue({});

    await adminAuditLogService.record(
      ADMIN_ID, AdminAction.USER_STATUS_UPDATED, AdminTargetType.USER, TARGET_ID, { from: 'active', to: 'banned' }
    );

    expect(AdminAuditLog.create).toHaveBeenCalledWith({
      admin: ADMIN_ID,
      action: AdminAction.USER_STATUS_UPDATED,
      targetType: AdminTargetType.USER,
      targetId: TARGET_ID,
      details: { from: 'active', to: 'banned' },
    });
  });

  it('lỗi ghi log không được làm hỏng thao tác chính đang gọi nó', async () => {
    AdminAuditLog.create.mockRejectedValue(new Error('Mongo down'));

    await expect(
      adminAuditLogService.record(ADMIN_ID, AdminAction.FIELD_VERIFIED, AdminTargetType.FIELD, TARGET_ID)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('getAuditLog', () => {
  it('trả về danh sách kèm phân trang, mới nhất trước', async () => {
    const populate = jest.fn().mockReturnThis();
    const lean = jest.fn().mockResolvedValue([{ action: AdminAction.INVOICE_VOIDED }]);
    const limit = jest.fn().mockReturnValue({ populate, lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    AdminAuditLog.find.mockReturnValue({ sort });
    AdminAuditLog.countDocuments.mockResolvedValue(1);

    const result = await adminAuditLogService.getAuditLog({ page: 1, limit: 10 });

    expect(sort).toHaveBeenCalledWith('-createdAt');
    expect(result).toMatchObject({ total: 1, page: 1, limit: 10 });
    expect(result.logs).toHaveLength(1);
  });

  it('lọc theo adminId và action khi có truyền', async () => {
    const chain = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    AdminAuditLog.find.mockReturnValue(chain);
    AdminAuditLog.countDocuments.mockResolvedValue(0);

    await adminAuditLogService.getAuditLog({ adminId: ADMIN_ID, action: AdminAction.INVOICE_CONFIRMED });

    expect(AdminAuditLog.find).toHaveBeenCalledWith({ admin: ADMIN_ID, action: AdminAction.INVOICE_CONFIRMED });
  });
});
