import api from './api';
import type { ApiResponse, OwnerReview, Review } from '@/types';

const reviewService = {
  getFieldReviews: (fieldId: string, params?: { page?: number; limit?: number; rating?: number }) =>
    api.get<ApiResponse<{ reviews: Review[] }>>(`/reviews/field/${fieldId}`, { params }),

  create: (data: FormData) =>
    api.post<ApiResponse<{ review: Review }>>('/reviews', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: string, data: { rating?: number; comment?: string }) =>
    api.patch<ApiResponse<{ review: Review }>>(`/reviews/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/reviews/${id}`),

  toggleLike: (id: string) =>
    api.post<ApiResponse<{ liked: boolean }>>(`/reviews/${id}/like`),

  ownerReply: (id: string, comment: string) =>
    api.post<ApiResponse<{ review: Review }>>(`/reviews/${id}/reply`, { comment }),

  getMyReviews: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<{ reviews: Review[] }>>('/reviews/me', { params }),

  /** Đánh giá trên mọi sân của chủ sân đang đăng nhập. */
  getOwnerReviews: (params?: { page?: number; limit?: number; fieldId?: string; rating?: number; unanswered?: 'true' }) =>
    api.get<ApiResponse<{ reviews: OwnerReview[]; unanswered: number }>>('/reviews/owner/reviews', { params }),
};

export default reviewService;
