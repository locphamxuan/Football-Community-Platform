jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

interface StoreMock {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
}

/**
 * `session` giữ token trong biến module, nên mỗi test phải nạp lại module
 * để không thừa hưởng phiên của test trước.
 */
const load = () => ({
  store: require('expo-secure-store') as unknown as StoreMock,
  session: require('./session') as typeof import('./session'),
});

beforeEach(() => {
  jest.resetModules();
});

describe('restoreSession', () => {
  it('khôi phục phiên khi Keychain còn đủ hai token', async () => {
    const { store, session } = load();
    store.getItemAsync.mockImplementation(async (key: string) =>
      key === 'fcp.accessToken' ? 'access-1' : 'refresh-1'
    );

    await expect(session.restoreSession()).resolves.toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(session.getAccessToken()).toBe('access-1');
    expect(session.getRefreshToken()).toBe('refresh-1');
  });

  it('coi như chưa đăng nhập khi thiếu refresh token', async () => {
    const { store, session } = load();
    store.getItemAsync.mockImplementation(async (key: string) =>
      key === 'fcp.accessToken' ? 'access-1' : null
    );

    await expect(session.restoreSession()).resolves.toBeNull();
    expect(session.getAccessToken()).toBeNull();
  });

  it('không làm vỡ app khi Keychain lỗi', async () => {
    const { store, session } = load();
    store.getItemAsync.mockRejectedValue(new Error('Keychain locked'));

    await expect(session.restoreSession()).resolves.toBeNull();
    expect(session.getAccessToken()).toBeNull();
  });
});

describe('saveSession', () => {
  it('ghi cả hai token và dùng được ngay không cần đọc lại', async () => {
    const { store, session } = load();
    store.setItemAsync.mockResolvedValue(undefined);

    await session.saveSession({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    expect(store.setItemAsync).toHaveBeenCalledWith('fcp.accessToken', 'access-2');
    expect(store.setItemAsync).toHaveBeenCalledWith('fcp.refreshToken', 'refresh-2');
    expect(session.getAccessToken()).toBe('access-2');
  });

  it('giữ phiên trong RAM khi Keychain ghi hỏng', async () => {
    const { store, session } = load();
    store.setItemAsync.mockRejectedValue(new Error('no space'));

    await expect(
      session.saveSession({ accessToken: 'access-3', refreshToken: 'refresh-3' })
    ).resolves.toBeUndefined();
    expect(session.getAccessToken()).toBe('access-3');
  });
});

describe('clearSession', () => {
  it('xoá token khỏi RAM lẫn Keychain', async () => {
    const { store, session } = load();
    store.setItemAsync.mockResolvedValue(undefined);
    store.deleteItemAsync.mockResolvedValue(undefined);
    await session.saveSession({ accessToken: 'access-4', refreshToken: 'refresh-4' });

    await session.clearSession();

    expect(session.getAccessToken()).toBeNull();
    expect(session.getRefreshToken()).toBeNull();
    expect(store.deleteItemAsync).toHaveBeenCalledWith('fcp.accessToken');
    expect(store.deleteItemAsync).toHaveBeenCalledWith('fcp.refreshToken');
  });

  it('vẫn đăng xuất được khi Keychain từ chối xoá', async () => {
    const { store, session } = load();
    store.setItemAsync.mockResolvedValue(undefined);
    store.deleteItemAsync.mockRejectedValue(new Error('Keychain locked'));
    await session.saveSession({ accessToken: 'access-5', refreshToken: 'refresh-5' });

    await expect(session.clearSession()).resolves.toBeUndefined();
    expect(session.getAccessToken()).toBeNull();
  });
});
