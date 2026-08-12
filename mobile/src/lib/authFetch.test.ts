jest.mock('./session', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

import { API_URL } from './api';
import { authFetch, setSessionExpiredHandler } from './authFetch';
import * as session from './session';

const getAccessToken = session.getAccessToken as jest.Mock;
const getRefreshToken = session.getRefreshToken as jest.Mock;
const saveSession = session.saveSession as jest.Mock;
const clearSession = session.clearSession as jest.Mock;

interface Reply {
  status: number;
  body: unknown;
}

const ok = (data: unknown): Reply => ({ status: 200, body: { success: true, message: 'ok', data } });
const fail = (status: number, message = 'Phiên đã hết hạn'): Reply => ({
  status,
  body: { success: false, message },
});

/** Mỗi path có một hàng đợi phản hồi; phản hồi cuối được dùng lại cho các lần gọi sau. */
const queues: Record<string, Reply[]> = {};
const on = (path: string, ...replies: Reply[]) => {
  queues[path] = replies;
};

const callsTo = (path: string) =>
  (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url) === `${API_URL}${path}`);

const authHeaderOf = (call: unknown[]) =>
  (call[1] as { headers: Record<string, string> }).headers.Authorization;

beforeEach(() => {
  Object.keys(queues).forEach((key) => delete queues[key]);
  jest.clearAllMocks();
  setSessionExpiredHandler(null);
  getAccessToken.mockReturnValue('access-cũ');
  getRefreshToken.mockReturnValue('refresh-cũ');

  global.fetch = jest.fn(async (url: string) => {
    const path = String(url).replace(API_URL, '');
    const queue = queues[path];
    if (!queue?.length) throw new Error(`Test chưa khai báo phản hồi cho ${path}`);
    const reply = queue.length > 1 ? (queue.shift() as Reply) : queue[0];
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body,
    };
  }) as unknown as typeof fetch;
});

describe('authFetch', () => {
  it('gắn access token đang giữ vào request', async () => {
    on('/bookings/my', ok({ bookings: [] }));

    await expect(authFetch('/bookings/my')).resolves.toEqual({ bookings: [] });
    expect(authHeaderOf(callsTo('/bookings/my')[0])).toBe('Bearer access-cũ');
  });

  it('làm mới token rồi gọi lại khi access token hết hạn', async () => {
    on('/bookings/my', fail(401), ok({ bookings: [{ _id: 'b1' }] }));
    on('/auth/refresh-token', ok({ accessToken: 'access-mới', refreshToken: 'refresh-mới' }));

    await expect(authFetch('/bookings/my')).resolves.toEqual({ bookings: [{ _id: 'b1' }] });
    expect(saveSession).toHaveBeenCalledWith({
      accessToken: 'access-mới',
      refreshToken: 'refresh-mới',
    });
    expect(authHeaderOf(callsTo('/bookings/my')[1])).toBe('Bearer access-mới');
  });

  it('giữ refresh token cũ khi backend không xoay vòng', async () => {
    on('/bookings/my', fail(401), ok(null));
    on('/auth/refresh-token', ok({ accessToken: 'access-mới' }));

    await authFetch('/bookings/my');

    expect(saveSession).toHaveBeenCalledWith({
      accessToken: 'access-mới',
      refreshToken: 'refresh-cũ',
    });
  });

  it('không gọi refresh khi máy chưa có phiên nào', async () => {
    getRefreshToken.mockReturnValue(null);
    on('/bookings/my', fail(401));

    await expect(authFetch('/bookings/my')).rejects.toMatchObject({ status: 401 });
    expect(callsTo('/auth/refresh-token')).toHaveLength(0);
  });

  it('xoá phiên và báo hết hạn khi refresh token bị từ chối', async () => {
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    on('/bookings/my', fail(401));
    on('/auth/refresh-token', fail(401, 'Refresh token không hợp lệ'));

    await expect(authFetch('/bookings/my')).rejects.toMatchObject({ status: 401 });
    expect(clearSession).toHaveBeenCalled();
    expect(onExpired).toHaveBeenCalled();
  });

  it('không làm mới token với lỗi khác 401', async () => {
    on('/admin/overview', fail(403, 'Không có quyền'));

    await expect(authFetch('/admin/overview')).rejects.toMatchObject({ status: 403 });
    expect(callsTo('/auth/refresh-token')).toHaveLength(0);
  });

  // Refresh token của backend xoay vòng: gọi hai lần thì lần thứ hai bị coi là dùng lại và huỷ cả phiên.
  it('chỉ làm mới một lần khi nhiều request cùng hết hạn', async () => {
    on('/bookings/my', fail(401), ok({ bookings: [] }));
    on('/notifications', fail(401), ok({ notifications: [] }));
    on('/auth/refresh-token', ok({ accessToken: 'access-mới', refreshToken: 'refresh-mới' }));

    await Promise.all([authFetch('/bookings/my'), authFetch('/notifications')]);

    expect(callsTo('/auth/refresh-token')).toHaveLength(1);
  });
});
