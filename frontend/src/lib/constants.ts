export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Football Community Platform';

export const FIELD_TYPES = ['5v5', '7v7', '11v11'] as const;
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;
export const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'] as const;
export const SURFACES = ['natural_grass', 'artificial_grass', 'concrete'] as const;
export const AMENITIES = ['parking', 'shower', 'cafeteria', 'changing_room', 'wifi', 'lighting', 'tribunes'] as const;

export const PAYMENT_METHODS = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  online: 'Online',
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
  completed: 'Hoàn thành',
  no_show: 'Không đến',
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  no_show: 'bg-gray-100 text-gray-800',
};

export const MATCH_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ phản hồi',
  accepted: 'Đã chấp nhận',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy',
  completed: 'Hoàn thành',
};

export const MATCH_REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  completed: 'bg-green-100 text-green-800',
};

export const SURFACE_LABELS: Record<string, string> = {
  natural_grass: 'Cỏ tự nhiên',
  artificial_grass: 'Cỏ nhân tạo',
  concrete: 'Sân xi măng',
};

export const AMENITY_LABELS: Record<string, string> = {
  parking: 'Bãi đỗ xe',
  shower: 'Phòng tắm',
  cafeteria: 'Căng tin',
  changing_room: 'Phòng thay đồ',
  wifi: 'Wifi',
  lighting: 'Đèn chiếu sáng',
  tribunes: 'Khán đài',
};

export const FIELD_STATUS_LABELS: Record<string, string> = {
  active: 'Đang hoạt động',
  inactive: 'Tạm ngưng',
  pending_approval: 'Chờ duyệt',
};

export const FIELD_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
};

export const SUBFIELD_STATUS_LABELS: Record<string, string> = {
  available: 'Sẵn sàng',
  maintenance: 'Đang bảo trì',
  closed: 'Đã đóng',
};

export const SUBFIELD_STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-red-100 text-red-800',
};

export const SKILL_LEVEL_LABELS: Record<string, string> = {
  beginner: 'Mới chơi',
  intermediate: 'Trung bình',
  advanced: 'Khá',
  professional: 'Chuyên nghiệp',
};

export const ROLE_LABELS: Record<string, string> = {
  user: 'Người chơi',
  team_manager: 'Quản lý đội',
  field_owner: 'Chủ sân',
  admin: 'Quản trị viên',
};

export const ROLE_COLORS: Record<string, string> = {
  user: 'bg-gray-100 text-gray-700',
  team_manager: 'bg-blue-100 text-blue-700',
  field_owner: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-purple-100 text-purple-700',
};

export const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Đang hoạt động',
  inactive: 'Tạm ngưng',
  banned: 'Bị cấm',
};

export const USER_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  banned: 'bg-red-100 text-red-800',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'Đang hiệu lực',
  past_due: 'Chưa thanh toán',
  cancelled: 'Đã huỷ gia hạn',
};

export const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  past_due: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ thanh toán',
  awaiting_confirmation: 'Chờ đối soát',
  paid: 'Đã thanh toán',
  void: 'Đã huỷ',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  awaiting_confirmation: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  void: 'bg-gray-100 text-gray-800',
};

export const SKILL_LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-gray-100 text-gray-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-orange-100 text-orange-700',
  professional: 'bg-purple-100 text-purple-700',
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  booking_created: 'Lịch đặt mới',
  booking_confirmed: 'Lịch đặt được xác nhận',
  booking_cancelled: 'Lịch đặt bị huỷ',
  match_request_received: 'Lời mời thi đấu',
  match_request_answered: 'Phản hồi lời mời',
  match_result_submitted: 'Kết quả trận đấu',
  invoice_issued: 'Hoá đơn mới',
  chat_message: 'Tin nhắn mới',
};
