import api from './api';
import type { ApiResponse, Field, SubField, SubFieldAvailability } from '@/types';

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

const fieldService = {
  getFields: (params: FieldFilters) =>
    api.get<ApiResponse<{ fields: Field[] }>>('/fields', { params }),

  getFieldById: (id: string) =>
    api.get<ApiResponse<{ field: Field }>>(`/fields/${id}`),

  getMyFields: () =>
    api.get<ApiResponse<{ fields: Field[] }>>('/fields/owner/my-fields'),

  checkAvailability: (id: string, params: AvailabilityQuery) =>
    api.get<ApiResponse<{ availability: SubFieldAvailability[] }>>(`/fields/${id}/availability`, { params }),

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
};

export default fieldService;
