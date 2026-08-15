const priceFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const formatPrice = (n: number) => priceFormatter.format(n);

/** Hạn mức -1 nghĩa là không giới hạn (xem shared/types.ts, Plan.includedBookingsPerMonth). */
export const formatQuota = (n: number) => (n < 0 ? 'Không giới hạn' : String(n));

/** Ngày hiển thị: "24/08/2026". Cắt theo UTC vì backend lưu ngày là nửa đêm UTC. */
export const formatDate = (iso: string) => {
  const [y, m, d] = new Date(iso).toISOString().slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** Ngày dạng YYYY-MM-DD để gửi lên API. */
export const toApiDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Khung giờ đọc được: "24/08/2026 · 18:00–20:00". */
export const formatSlot = (iso: string, startTime: string, endTime: string) =>
  `${formatDate(iso)} · ${startTime}–${endTime}`;

const RELATIVE_STEPS: [limitSeconds: number, perUnit: number, unit: string][] = [
  [60, 1, 'giây'],
  [3600, 60, 'phút'],
  [86400, 3600, 'giờ'],
  [2592000, 86400, 'ngày'],
];

/** Khoảng cách tới hiện tại: "5 phút trước". Thông báo đọc bằng thời gian tương đối. */
export const formatRelativeTime = (iso: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const step = RELATIVE_STEPS.find(([limit]) => seconds < limit);
  if (!step) return formatDate(iso);
  const value = Math.floor(seconds / step[1]);
  return value <= 0 ? 'vừa xong' : `${value} ${step[2]} trước`;
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã huỷ',
  completed: 'Hoàn thành',
  no_show: 'Không đến',
};

export const MATCH_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ phản hồi',
  accepted: 'Đã nhận lời',
  rejected: 'Đã từ chối',
  cancelled: 'Đã huỷ',
  completed: 'Hoàn thành',
};

export const SKILL_LEVEL_LABELS: Record<string, string> = {
  beginner: 'Mới chơi',
  intermediate: 'Trung bình',
  advanced: 'Khá',
  professional: 'Chuyên nghiệp',
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
