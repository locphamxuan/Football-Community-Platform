import type { NotificationType, Review, User } from '@fcp/shared';
import { apiFetch } from '../lib/api';
import { authFetch } from '../lib/authFetch';
import { toQueryString } from './field.service';

export const userService = {
  updateProfile: (payload: {
    fullName?: string;
    phone?: string;
    location?: { city?: string; district?: string };
    playerProfile?: { positions?: string[]; skillLevel?: string; bio?: string };
  }) => authFetch<{ user: User }>('/users/me', { method: 'PATCH', body: payload }),

  /**
   * Tuỳ chọn thông báo có endpoint riêng: `PATCH /users/me` ghi đè cả cụm `notifications`,
   * nên gạt công tắc đẩy qua đường đó sẽ xoá sạch danh sách loại đã tắt.
   * `mutedTypes` gửi lên là **toàn bộ** danh sách đang tắt, không phải phần thêm bớt.
   */
  updateNotificationPrefs: (payload: { push?: boolean; mutedTypes?: NotificationType[] }) =>
    authFetch<{ user: User }>('/users/me/notifications', { method: 'PATCH', body: payload }),

  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => authFetch<{ message: string }>('/users/me/password', { method: 'PATCH', body: payload }),
};

export const reviewService = {
  forField: (fieldId: string, params: { page?: number; limit?: number } = {}) =>
    apiFetch<{ reviews: Review[] }>(`/reviews/field/${fieldId}${toQueryString(params)}`),

  myReviews: () => authFetch<{ reviews: Review[] }>('/reviews/me'),

  /**
   * Đánh giá đi qua multipart vì backend nhận kèm ảnh; `rating` tới nơi dưới dạng chuỗi
   * và được `z.coerce` ép lại về số (xem review.validation.js).
   */
  create: (payload: { fieldId: string; rating: number; comment?: string; bookingId?: string }) =>
    authFetch<{ review: Review }>('/reviews', {
      method: 'POST',
      form: {
        fieldId: payload.fieldId,
        rating: String(payload.rating),
        ...(payload.comment ? { comment: payload.comment } : {}),
        ...(payload.bookingId ? { bookingId: payload.bookingId } : {}),
      },
    }),
};
