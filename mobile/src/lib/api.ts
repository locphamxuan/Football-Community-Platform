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
  token?: string | null;
  signal?: AbortSignal;
}

/** Gọi API và trả về phần `data` — ném ApiError kèm message của backend khi thất bại. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
