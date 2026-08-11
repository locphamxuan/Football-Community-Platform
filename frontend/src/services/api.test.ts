import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import api from './api';

/**
 * Test đi qua interceptor thật bằng cách thay adapter — tầng cuối cùng của axios,
 * nơi request lẽ ra chạm mạng. Không mock axios, nên logic gắn token và tự làm
 * mới token được kiểm tra đúng như lúc chạy thật.
 */
type Handler = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

const ok = (config: InternalAxiosRequestConfig, data: unknown = {}): AxiosResponse => ({
  data, status: 200, statusText: 'OK', headers: {}, config,
});

const unauthorized = (config: InternalAxiosRequestConfig) => Promise.reject(
  Object.assign(new Error('Request failed with status code 401'), {
    isAxiosError: true,
    config,
    response: { status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config },
  })
);

/** Ghi lại mọi request đi qua adapter và trả lời theo kịch bản. */
const useAdapter = (handler: Handler) => {
  const seen: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
    seen.push(config);
    return handler(config);
  }) as AxiosAdapter;
  return seen;
};

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('gắn access token', () => {
  it('thêm header Authorization khi đã đăng nhập', async () => {
    sessionStorage.setItem('accessToken', 'token-hien-tai');
    const seen = useAdapter((config) => Promise.resolve(ok(config)));

    await api.get('/users/me');

    expect(seen[0].headers.Authorization).toBe('Bearer token-hien-tai');
  });

  it('không gắn header khi chưa đăng nhập', async () => {
    const seen = useAdapter((config) => Promise.resolve(ok(config)));

    await api.get('/fields');

    expect(seen[0].headers.Authorization).toBeUndefined();
  });

  it('gửi kèm cookie để refresh token đi theo', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });
});

describe('tự làm mới token khi gặp 401', () => {
  it('gọi refresh-token, lưu token mới rồi chạy lại request cũ', async () => {
    sessionStorage.setItem('accessToken', 'token-het-han');
    let firstCall = true;

    const seen = useAdapter((config) => {
      if (config.url?.includes('refresh-token')) {
        return Promise.resolve(ok(config, { data: { accessToken: 'token-moi' } }));
      }
      if (firstCall) {
        firstCall = false;
        return unauthorized(config);
      }
      return Promise.resolve(ok(config, { data: { user: { id: '1' } } }));
    });

    const res = await api.get('/users/me');

    expect(res.data.data.user.id).toBe('1');
    expect(sessionStorage.getItem('accessToken')).toBe('token-moi');
    expect(seen.map((c) => c.url)).toEqual(['/users/me', '/auth/refresh-token', '/users/me']);
    // Request chạy lại phải mang token mới, không phải token đã hết hạn
    expect(seen[2].headers.Authorization).toBe('Bearer token-moi');
  });

  it('chỉ thử làm mới một lần cho mỗi request — tránh vòng lặp vô tận', async () => {
    sessionStorage.setItem('accessToken', 'token-het-han');
    vi.spyOn(window, 'location', 'get').mockReturnValue({ href: '' } as Location);

    const seen = useAdapter((config) => (
      config.url?.includes('refresh-token')
        ? Promise.resolve(ok(config, { data: { accessToken: 'token-moi' } }))
        : unauthorized(config)
    ));

    await expect(api.get('/users/me')).rejects.toBeDefined();

    expect(seen.filter((c) => c.url?.includes('refresh-token'))).toHaveLength(1);
  });

  it('làm mới thất bại thì xoá token và đưa về trang đăng nhập', async () => {
    sessionStorage.setItem('accessToken', 'token-het-han');
    const location = { href: '' } as Location;
    vi.spyOn(window, 'location', 'get').mockReturnValue(location);

    useAdapter((config) => unauthorized(config));

    await expect(api.get('/users/me')).rejects.toBeDefined();

    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(location.href).toBe('/login');
  });
});

describe('các lỗi khác', () => {
  it('lỗi không phải 401 được trả nguyên vẹn, không thử làm mới token', async () => {
    const seen = useAdapter((config) => Promise.reject(
      Object.assign(new Error('Server error'), {
        isAxiosError: true,
        config,
        response: { status: 500, data: {}, statusText: 'Error', headers: {}, config },
      })
    ));

    await expect(api.get('/fields')).rejects.toBeDefined();

    expect(seen).toHaveLength(1);
  });
});
