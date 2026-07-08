import api from './api';
import type { ApiResponse, Field, SubFieldAvailability } from '@/types';

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
};

export default fieldService;
