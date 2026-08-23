import api from './api';
import type { ApiResponse, Field, PriceQuote, Promotion, SubField, SubFieldAvailability } from '@/types';

export interface SubFieldPayload {
  name: string;
  fieldType: SubField['fieldType'];
  surface: SubField['surface'];
  capacity: number;
}

export interface FieldFilters {
  search?: string;
  city?: string;
  district?: string;
  fieldType?: string;
  minRating?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface AvailabilityQuery {
  date: string;
  startTime: string;
  endTime: string;
  fieldType?: string;
}

export interface PriceQuoteQuery {
  date: string;
  startTime: string;
  endTime: string;
  promoCode?: string;
}

export interface PriceOverridePayload {
  name: string;
  startDate: string;
  endDate: string;
  weekday: { morning: number; afternoon: number; evening: number };
  weekend: { morning: number; afternoon: number; evening: number };
}

export interface PromotionPayload {
  code: string;
  type: Promotion['type'];
  value: number;
  slots?: Promotion['slots'];
  startDate: string;
  endDate: string;
  maxUses?: number;
}

const fieldService = {
  getFields: (params: FieldFilters) =>
    api.get<ApiResponse<{ fields: Field[] }>>('/fields', { params }),

  getFieldById: (id: string) =>
    api.get<ApiResponse<{ field: Field }>>(`/fields/${id}`),

  getMyFields: () =>
    api.get<ApiResponse<{ fields: Field[] }>>('/fields/owner/my-fields'),

  checkAvailability: (id: string, params: AvailabilityQuery) =>
    api.get<ApiResponse<{ availability: SubFieldAvailability[] }>>(`/fields/${id}/availability`, { params }),

  getPriceQuote: (id: string, params: PriceQuoteQuery) =>
    api.get<ApiResponse<PriceQuote>>(`/fields/${id}/price-quote`, { params }),

  createField: (data: FormData) =>
    api.post<ApiResponse<{ field: Field }>>('/fields', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateField: (id: string, data: FormData) =>
    api.patch<ApiResponse<{ field: Field }>>(`/fields/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteField: (id: string) => api.delete(`/fields/${id}`),

  /** Chủ sân gửi sân sang hàng chờ duyệt của admin. */
  submitForApproval: (id: string) =>
    api.patch<ApiResponse<{ field: Field }>>(`/fields/${id}/submit`),

  /** Admin duyệt hoặc từ chối sân. */
  verifyField: (id: string, approve: boolean, note?: string) =>
    api.patch<ApiResponse<{ field: Field }>>(`/fields/${id}/verify`, { approve, note }),

  // ── Sân con ────────────────────────────────────────────────────────────────
  addSubField: (fieldId: string, data: SubFieldPayload) =>
    api.post<ApiResponse<{ field: Field }>>(`/fields/${fieldId}/sub-fields`, data),

  updateSubField: (fieldId: string, subFieldId: string, data: Partial<SubFieldPayload> & { status?: SubField['status'] }) =>
    api.patch<ApiResponse<{ field: Field }>>(`/fields/${fieldId}/sub-fields/${subFieldId}`, data),

  deleteSubField: (fieldId: string, subFieldId: string) =>
    api.delete<ApiResponse<{ field: Field }>>(`/fields/${fieldId}/sub-fields/${subFieldId}`),

  // ── Giá theo ngày & khuyến mãi ────────────────────────────────────────────
  addPriceOverride: (fieldId: string, data: PriceOverridePayload) =>
    api.post<ApiResponse<{ field: Field }>>(`/fields/${fieldId}/price-overrides`, data),

  deletePriceOverride: (fieldId: string, overrideId: string) =>
    api.delete<ApiResponse<{ field: Field }>>(`/fields/${fieldId}/price-overrides/${overrideId}`),

  addPromotion: (fieldId: string, data: PromotionPayload) =>
    api.post<ApiResponse<{ field: Field }>>(`/fields/${fieldId}/promotions`, data),

  updatePromotion: (fieldId: string, promoId: string, data: Partial<PromotionPayload> & { active?: boolean }) =>
    api.patch<ApiResponse<{ field: Field }>>(`/fields/${fieldId}/promotions/${promoId}`, data),

  deletePromotion: (fieldId: string, promoId: string) =>
    api.delete<ApiResponse<{ field: Field }>>(`/fields/${fieldId}/promotions/${promoId}`),
};

export default fieldService;
