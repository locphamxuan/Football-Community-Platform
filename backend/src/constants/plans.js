/**
 * Gói thuê bao chủ sân trả cho nền tảng.
 * Đây là nguồn doanh thu của nền tảng — booking là tiền của chủ sân, không phải của nền tảng.
 */
const PlanCode = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
};

const PLANS = {
  [PlanCode.FREE]: {
    code: PlanCode.FREE,
    name: 'Miễn phí',
    monthlyPrice: 0,
    maxFields: 1,
    maxSubFieldsPerField: 2,
    includedBookingsPerMonth: 50,
    features: ['1 sân', 'Tối đa 2 sân con mỗi sân', 'Quản lý lịch đặt cơ bản'],
  },
  [PlanCode.BASIC]: {
    code: PlanCode.BASIC,
    name: 'Cơ bản',
    monthlyPrice: 299000,
    maxFields: 3,
    maxSubFieldsPerField: 6,
    includedBookingsPerMonth: 500,
    features: ['3 sân', 'Tối đa 6 sân con mỗi sân', 'Báo cáo doanh thu theo tháng'],
  },
  [PlanCode.PRO]: {
    code: PlanCode.PRO,
    name: 'Chuyên nghiệp',
    monthlyPrice: 799000,
    maxFields: 20,
    maxSubFieldsPerField: 20,
    includedBookingsPerMonth: -1, // không giới hạn
    features: ['20 sân', 'Tối đa 20 sân con mỗi sân', 'Không giới hạn lượt đặt', 'Ưu tiên hỗ trợ'],
  },
};

const PLAN_CODES = Object.keys(PLANS);

const getPlan = (code) => PLANS[code] || PLANS[PlanCode.FREE];

const SubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
};

const InvoiceStatus = {
  PENDING: 'pending', // đã phát hành, chủ sân chưa thanh toán
  AWAITING_CONFIRMATION: 'awaiting_confirmation', // chủ sân báo đã chuyển khoản, chờ admin đối soát
  PAID: 'paid', // admin đã xác nhận nhận tiền
  VOID: 'void', // huỷ hoá đơn
};

module.exports = { PlanCode, PLANS, PLAN_CODES, getPlan, SubscriptionStatus, InvoiceStatus };
