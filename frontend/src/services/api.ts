import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/lib/constants';

/**
 * Access lẫn refresh token đều nằm trong cookie `httpOnly` do backend đặt — trình duyệt tự
 * đính kèm chúng (`withCredentials: true`), nên không có Authorization nào để gắn bằng tay
 * và cũng không có token nào để JS đọc ra (kể cả bị XSS).
 */
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Response interceptor: silent refresh khi 401 ─────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Chính lời gọi refresh mà 401 (refresh token hết hạn) thì phải để lỗi đi tiếp:
    // đẩy nó vào hàng đợi là tự chờ chính mình, request treo vĩnh viễn.
    const isRefreshCall = original.url?.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !original._retry && !isRefreshCall) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // Không cần đọc data — backend đặt lại cookie accessToken/refreshToken mới,
        // request gốc chạy lại sẽ tự mang theo cookie đó.
        await api.post('/auth/refresh-token');
        processQueue(null);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
