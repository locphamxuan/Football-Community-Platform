const { createTeamSchema, transferManagementSchema } = require('../../src/validations/team.validation');
const { createReviewSchema } = require('../../src/validations/review.validation');
const {
  createMatchRequestSchema, respondToRequestSchema,
} = require('../../src/validations/matchRequest.validation');
const { teamBookingsQuerySchema } = require('../../src/validations/booking.validation');
const { adminUsersQuerySchema, updateUserSchema } = require('../../src/validations/admin.validation');
const { invoiceQuerySchema, changePlanSchema } = require('../../src/validations/billing.validation');

/** Ngày trong tương lai để không dính rule "date cannot be in the past". */
const futureDate = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

describe('form-data gửi mọi thứ dưới dạng chuỗi', () => {
  it('ép "true"/"false" của isPublic về boolean', () => {
    expect(createTeamSchema.parse({ name: 'Probe FC', isPublic: 'false' }).isPublic).toBe(false);
    expect(createTeamSchema.parse({ name: 'Probe FC', isPublic: 'true' }).isPublic).toBe(true);
  });

  it('vẫn nhận boolean thật', () => {
    expect(createTeamSchema.parse({ name: 'Probe FC', isPublic: true }).isPublic).toBe(true);
  });

  it('từ chối chuỗi không phải boolean', () => {
    expect(createTeamSchema.safeParse({ name: 'Probe FC', isPublic: 'yes' }).success).toBe(false);
  });

  it('ép maxMembers dạng chuỗi về số', () => {
    expect(createTeamSchema.parse({ name: 'Probe FC', maxMembers: '12' }).maxMembers).toBe(12);
  });

  it('ép rating của review dạng chuỗi về số', () => {
    expect(createReviewSchema.parse({ fieldId: 'f1', rating: '4' }).rating).toBe(4);
  });

  it('vẫn chặn rating ngoài khoảng 1–5', () => {
    expect(createReviewSchema.safeParse({ fieldId: 'f1', rating: '6' }).success).toBe(false);
  });
});

describe('createMatchRequestSchema', () => {
  const valid = () => ({
    requesterTeamId: 't1',
    opponentTeamId: 't2',
    date: futureDate(),
    startTime: '18:00',
    endTime: '20:00',
    fieldSize: '5v5',
  });

  it('nhận lời mời hợp lệ', () => {
    expect(createMatchRequestSchema.safeParse(valid()).success).toBe(true);
  });

  it('bắt buộc có requesterTeamId', () => {
    const { requesterTeamId, ...rest } = valid();
    expect(createMatchRequestSchema.safeParse(rest).success).toBe(false);
  });

  it('từ chối giờ kết thúc không sau giờ bắt đầu', () => {
    expect(createMatchRequestSchema.safeParse({ ...valid(), startTime: '20:00', endTime: '18:00' }).success).toBe(false);
  });

  it('từ chối ngày trong quá khứ', () => {
    expect(createMatchRequestSchema.safeParse({ ...valid(), date: '2020-01-01' }).success).toBe(false);
  });

  it('respondToRequestSchema đòi accept là boolean', () => {
    expect(respondToRequestSchema.safeParse({ accept: true }).success).toBe(true);
    expect(respondToRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('query của khu quản lý', () => {
  it('teamBookingsQuerySchema ép page/limit về số', () => {
    const parsed = teamBookingsQuerySchema.parse({ page: '2', limit: '20' });
    expect(parsed).toMatchObject({ page: 2, limit: 20 });
  });

  it('teamBookingsQuerySchema chặn status lạ', () => {
    expect(teamBookingsQuerySchema.safeParse({ status: 'bogus' }).success).toBe(false);
  });

  it('teamBookingsQuerySchema chặn ngày sai định dạng', () => {
    expect(teamBookingsQuerySchema.safeParse({ startDate: '10-08-2026' }).success).toBe(false);
  });

  it('teamBookingsQuerySchema chặn limit vượt trần 100', () => {
    expect(teamBookingsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('adminUsersQuerySchema chỉ nhận role hợp lệ', () => {
    expect(adminUsersQuerySchema.safeParse({ role: 'field_owner' }).success).toBe(true);
    expect(adminUsersQuerySchema.safeParse({ role: 'superuser' }).success).toBe(false);
  });

  it('invoiceQuerySchema chỉ nhận trạng thái hoá đơn có thật', () => {
    expect(invoiceQuerySchema.safeParse({ status: 'awaiting_confirmation' }).success).toBe(true);
    expect(invoiceQuerySchema.safeParse({ status: 'refunded' }).success).toBe(false);
  });

  it('changePlanSchema chỉ nhận mã gói có thật', () => {
    expect(changePlanSchema.safeParse({ plan: 'pro' }).success).toBe(true);
    expect(changePlanSchema.safeParse({ plan: 'diamond' }).success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('từ chối body rỗng — phải có status hoặc roles', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it('từ chối mảng roles rỗng', () => {
    expect(updateUserSchema.safeParse({ roles: [] }).success).toBe(false);
  });

  it('nhận cập nhật chỉ status', () => {
    expect(updateUserSchema.safeParse({ status: 'banned' }).success).toBe(true);
  });
});

describe('transferManagementSchema', () => {
  it('đòi newManagerId', () => {
    expect(transferManagementSchema.safeParse({ newManagerId: 'u1' }).success).toBe(true);
    expect(transferManagementSchema.safeParse({ newManagerId: '' }).success).toBe(false);
  });
});
