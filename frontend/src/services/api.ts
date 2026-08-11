import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/lib/constants';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // gửi cookie refreshToken
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: gắn accessToken ─────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: silent refresh khi 401 ─────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
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
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (original.headers) original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh-token');
        const newToken: string = data.data.accessToken;
        sessionStorage.setItem('accessToken', newToken);
        if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        sessionStorage.removeItem('accessToken');
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
