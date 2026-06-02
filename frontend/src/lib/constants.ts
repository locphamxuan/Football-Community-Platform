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

export const SKILL_LEVEL_LABELS: Record<string, string> = {
  beginner: 'Mới chơi',
  intermediate: 'Trung bình',
  advanced: 'Khá',
  professional: 'Chuyên nghiệp',
};

export const SKILL_LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-gray-100 text-gray-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-orange-100 text-orange-700',
  professional: 'bg-purple-100 text-purple-700',
};
