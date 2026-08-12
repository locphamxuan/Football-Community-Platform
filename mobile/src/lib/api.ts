import type { ApiResponse } from '@fcp/shared';

/**
 * Android emulator không thấy localhost của máy host — 10.0.2.2 mới trỏ về nó.
 * Đặt EXPO_PUBLIC_API_URL khi chạy trên máy thật hoặc khi backend đã lên server.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:5001/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Endpoint nhận multipart/form-data (tạo đội, đổi ảnh đại diện). Dùng thay cho `body`. */
  form?: Record<string, string>;
  token?: string | null;
  signal?: AbortSignal;
}

const buildPayload = (options: RequestOptions) => {
  if (options.form) {
    const form = new FormData();
    Object.entries(options.form).forEach(([key, value]) => form.append(key, value));
    // Cố tình không đặt Content-Type: fetch phải tự sinh boundary, đặt tay là request hỏng.
    return { body: form, headers: {} as Record<string, string> };
  }
  if (options.body === undefined) return { body: undefined, headers: {} as Record<string, string> };
  return {
    body: JSON.stringify(options.body),
    headers: { 'Content-Type': 'application/json' } as Record<string, string>,
  };
};

/** Gọi API và trả về phần `data` — ném ApiError kèm message của backend khi thất bại. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token, signal } = options;
  const payloadParts = buildPayload(options);

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...payloadParts.headers,
      // Backend trả refresh token trong body cho client tự khai là mobile: app không có
      // cookie jar đáng tin cậy, nhưng có Keychain/Keystore để cất (xem auth.controller.js).
      'X-Client': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(payloadParts.body === undefined ? {} : { body: payloadParts.body }),
    signal,
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    // Body rỗng hoặc không phải JSON — rơi xuống nhánh lỗi bên dưới
  }

  if (!res.ok || !payload?.success) {
    throw new ApiError(payload?.message ?? 'Không kết nối được máy chủ', res.status, payload?.code);
  }

  return payload.data;
}
