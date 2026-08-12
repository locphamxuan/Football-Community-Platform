import type { Field, SubFieldAvailability } from '@fcp/shared';
import { apiFetch } from '../lib/api';

/** Tham số query string; interface bộ lọc kế thừa để truyền thẳng vào `toQueryString`. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface FieldFilters extends QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  district?: string;
  minRating?: number;
}

const query = (params: QueryParams) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const fieldService = {
  /** Danh sách sân là dữ liệu công khai — xem được trước cả khi đăng nhập. */
  search: (filters: FieldFilters = {}) => apiFetch<{ fields: Field[] }>(`/fields${query(filters)}`),

  getById: (id: string) => apiFetch<{ field: Field }>(`/fields/${id}`),

  getAvailability: (id: string, params: { date: string; startTime: string; endTime: string }) =>
    apiFetch<{ availability: SubFieldAvailability[] }>(`/fields/${id}/availability${query(params)}`),
};

export { query as toQueryString };
