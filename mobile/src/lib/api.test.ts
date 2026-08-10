import { ApiError, apiFetch } from './api';

const mockFetch = (status: number, body: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
};

describe('apiFetch', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('trả về phần data khi backend báo thành công', async () => {
    mockFetch(200, { success: true, message: 'Success', data: { plans: [] } });
    await expect(apiFetch('/billing/plans')).resolves.toEqual({ plans: [] });
  });

  it('gắn Bearer token khi được truyền vào', async () => {
    mockFetch(200, { success: true, message: 'ok', data: null });
    await apiFetch('/billing/subscription', { token: 'abc123' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer abc123');
  });

  it('không gắn Authorization khi không có token', async () => {
    mockFetch(200, { success: true, message: 'ok', data: null });
    await apiFetch('/billing/plans');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('gửi body dạng JSON cho POST', async () => {
    mockFetch(200, { success: true, message: 'ok', data: null });
    await apiFetch('/auth/login', { method: 'POST', body: { email: 'a@b.c' } });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.c' });
  });

  it('ném ApiError mang message và status của backend', async () => {
    mockFetch(401, { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });

    await expect(apiFetch('/admin/overview')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Unauthorized',
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('ném ApiError khi body không phải JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    }) as unknown as typeof fetch;

    await expect(apiFetch('/health')).rejects.toBeInstanceOf(ApiError);
  });

  it('coi success:false là lỗi kể cả khi HTTP 200', async () => {
    mockFetch(200, { success: false, message: 'Sai dữ liệu' });
    await expect(apiFetch('/teams')).rejects.toMatchObject({ message: 'Sai dữ liệu' });
  });
});
