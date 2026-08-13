jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/models/User', () => ({
  findOne: jest.fn(), findById: jest.fn(), find: jest.fn(),
  findByIdAndUpdate: jest.fn(), create: jest.fn(),
}));
jest.mock('../../src/utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const User = require('../../src/models/User');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../src/utils/email');
const authService = require('../../src/services/auth.service');
const env = require('../../src/config/env');
const { hashPassword, hashToken } = require('../../src/utils/bcrypt');
const { generateRefreshToken, generateAccessToken } = require('../../src/utils/jwt');
const { cache, CacheKeys, resetCache, ttlOf } = require('../helpers/fakeRedis');

const USER_ID = '000000000000000000000001';
const PASSWORD = 'Probe1234';

const registration = {
  email: 'probe@example.com',
  password: PASSWORD,
  username: 'probe_user',
  fullName: 'Probe User',
};

const inAnHour = () => new Date(Date.now() + 3600000);

/** Bản ghi user giả, mật khẩu đã băm thật để so sánh bcrypt chạy đúng đường. */
const fakeUser = async (overrides = {}) => ({
  _id: { toString: () => USER_ID },
  email: registration.email,
  username: registration.username,
  roles: ['user'],
  status: 'active',
  emailVerified: true,
  password: await hashPassword(PASSWORD),
  refreshTokens: [],
  ...overrides,
});

const selectReturns = (value) => ({ select: () => Promise.resolve(value) });

beforeEach(() => {
  resetCache();
  User.findByIdAndUpdate.mockResolvedValue({});
  User.create.mockResolvedValue({ _id: USER_ID });
});

describe('register', () => {
  it('tạo tài khoản chưa xác minh và gửi email kích hoạt', async () => {
    User.findOne.mockResolvedValue(null);

    const result = await authService.register(registration);

    expect(result.message).toMatch(/verify/i);
    expect(sendVerificationEmail).toHaveBeenCalledWith(registration.email, expect.any(String));
  });

  it('không lưu mật khẩu dạng thô', async () => {
    User.findOne.mockResolvedValue(null);

    await authService.register(registration);

    const saved = User.create.mock.calls[0][0];
    expect(saved.password).not.toBe(PASSWORD);
    // Token xác minh cũng được băm trước khi lưu — lộ DB không đồng nghĩa chiếm được tài khoản
    expect(saved.emailVerificationToken).not.toBe(sendVerificationEmail.mock.calls[0][1]);
  });

  it('email đã dùng thì báo đúng mã lỗi', async () => {
    User.findOne.mockResolvedValue({ email: registration.email, username: 'ai-do' });

    await expect(authService.register(registration))
      .rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_ALREADY_EXISTS' });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('username đã dùng thì báo mã lỗi khác', async () => {
    User.findOne.mockResolvedValue({ email: 'khac@example.com', username: registration.username });

    await expect(authService.register(registration))
      .rejects.toMatchObject({ code: 'USERNAME_ALREADY_EXISTS' });
  });
});

describe('login', () => {
  it('trả access token, refresh token và hồ sơ rút gọn', async () => {
    User.findOne.mockReturnValue(selectReturns(await fakeUser()));

    const result = await authService.login({ email: registration.email, password: PASSWORD }, 'jest', '127.0.0.1');

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).toMatchObject({ email: registration.email, roles: ['user'] });
  });

  it('không trả về mật khẩu hay danh sách refresh token', async () => {
    User.findOne.mockReturnValue(selectReturns(await fakeUser()));

    const { user } = await authService.login({ email: registration.email, password: PASSWORD }, 'jest', '');

    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('refreshTokens');
  });

  it('sai mật khẩu và không tồn tại email báo cùng một thông điệp', async () => {
    User.findOne.mockReturnValue(selectReturns(await fakeUser()));
    await expect(authService.login({ email: registration.email, password: 'SaiMatKhau1' }, 'jest', ''))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });

    User.findOne.mockReturnValue(selectReturns(null));
    await expect(authService.login({ email: 'khong-ton-tai@example.com', password: PASSWORD }, 'jest', ''))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
  });

  it('chưa xác minh email thì chưa đăng nhập được', async () => {
    User.findOne.mockReturnValue(selectReturns(await fakeUser({ emailVerified: false })));

    await expect(authService.login({ email: registration.email, password: PASSWORD }, 'jest', ''))
      .rejects.toMatchObject({ statusCode: 403, code: 'EMAIL_NOT_VERIFIED' });
  });

  it('tài khoản bị khoá thì bị chặn', async () => {
    User.findOne.mockReturnValue(selectReturns(await fakeUser({ status: 'banned' })));

    await expect(authService.login({ email: registration.email, password: PASSWORD }, 'jest', ''))
      .rejects.toMatchObject({ code: 'ACCOUNT_BANNED' });
  });

  it('chỉ giữ 5 phiên gần nhất', async () => {
    const stale = Array.from({ length: 5 }, (_, i) => ({
      tokenHash: `hash-${i}`, expiresAt: inAnHour(),
    }));
    User.findOne.mockReturnValue(selectReturns(await fakeUser({ refreshTokens: stale })));

    await authService.login({ email: registration.email, password: PASSWORD }, 'jest', '');

    const { refreshTokens } = User.findByIdAndUpdate.mock.calls[0][1];
    expect(refreshTokens).toHaveLength(5);
    expect(refreshTokens[0].tokenHash).toBe('hash-1');
  });

  it('bỏ các phiên đã hết hạn', async () => {
    const expired = [{ tokenHash: 'cu', expiresAt: new Date(Date.now() - 1000) }];
    User.findOne.mockReturnValue(selectReturns(await fakeUser({ refreshTokens: expired })));

    await authService.login({ email: registration.email, password: PASSWORD }, 'jest', '');

    const { refreshTokens } = User.findByIdAndUpdate.mock.calls[0][1];
    expect(refreshTokens).toHaveLength(1);
    expect(refreshTokens[0].tokenHash).not.toBe('cu');
  });
});

describe('refreshToken', () => {
  it('token không hợp lệ bị từ chối ngay', async () => {
    await expect(authService.refreshToken('rac', 'jest', ''))
      .rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALID' });
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('token hợp lệ được đổi lấy cặp token mới', async () => {
    const { token } = generateRefreshToken(USER_ID);
    User.findById.mockReturnValue(selectReturns(await fakeUser({
      refreshTokens: [{ tokenHash: await hashToken(token), expiresAt: inAnHour() }],
    })));

    const result = await authService.refreshToken(token, 'jest', '');

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).not.toBe(token);
  });

  it('token đã dùng lại lần hai xoá sạch mọi phiên', async () => {
    const { token } = generateRefreshToken(USER_ID);
    // Token đúng chữ ký nhưng không còn trong danh sách đang hoạt động = đã bị xoay
    User.findById.mockReturnValue(selectReturns(await fakeUser({ refreshTokens: [] })));

    await expect(authService.refreshToken(token, 'jest', ''))
      .rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALID' });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(expect.anything(), { refreshTokens: [] });
  });

  it('phiên hết hạn cũng bị coi là dùng lại', async () => {
    const { token } = generateRefreshToken(USER_ID);
    User.findById.mockReturnValue(selectReturns(await fakeUser({
      refreshTokens: [{ tokenHash: await hashToken(token), expiresAt: new Date(Date.now() - 1000) }],
    })));

    await expect(authService.refreshToken(token, 'jest', '')).rejects.toMatchObject({
      message: expect.stringMatching(/reuse/i),
    });
  });
});

describe('logout', () => {
  it('đưa access token vào danh sách thu hồi và xoá mọi phiên', async () => {
    const { token, jti } = generateAccessToken(USER_ID, registration.email, ['user']);

    await authService.logout(USER_ID, token);

    expect(await cache.exists(CacheKeys.blacklistedToken(jti))).toBe(true);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(USER_ID, { refreshTokens: [] });
  });

  // TTL từng bị đóng cứng 15 phút: đặt JWT_ACCESS_EXPIRES_IN dài hơn là token đã đăng
  // xuất dùng lại được từ phút thứ 15 cho tới lúc nó thật sự hết hạn.
  it('vé thu hồi sống đúng bằng tuổi của token, không phải một hằng số', async () => {
    const original = env.JWT_ACCESS_EXPIRES_IN;
    env.JWT_ACCESS_EXPIRES_IN = '1h';
    try {
      const { token, jti } = generateAccessToken(USER_ID, registration.email, ['user']);

      await authService.logout(USER_ID, token);

      const ttl = ttlOf(CacheKeys.blacklistedToken(jti));
      expect(ttl).toBeGreaterThan(3595);
      expect(ttl).toBeLessThanOrEqual(3600);
    } finally {
      env.JWT_ACCESS_EXPIRES_IN = original;
    }
  });

  it('token đã hỏng vẫn xoá được phiên, không ném lỗi', async () => {
    await expect(authService.logout(USER_ID, 'token-rac')).resolves.toBeUndefined();
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
  });
});

describe('verifyEmail', () => {
  it('token khớp thì đánh dấu đã xác minh và xoá token', async () => {
    const token = 'verify-token';
    User.find.mockReturnValue(selectReturns([
      { _id: USER_ID, emailVerificationToken: await hashToken(token) },
    ]));

    const result = await authService.verifyEmail(token);

    expect(result.message).toMatch(/verified/i);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ emailVerified: true }));
  });

  it('token sai bị từ chối', async () => {
    User.find.mockReturnValue(selectReturns([{ _id: USER_ID, emailVerificationToken: await hashToken('khac') }]));

    await expect(authService.verifyEmail('token-sai')).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
  });
});

describe('quên và đặt lại mật khẩu', () => {
  it('email lạ vẫn trả cùng một thông điệp — không để lộ ai có tài khoản', async () => {
    User.findOne.mockResolvedValue(null);

    const result = await authService.forgotPassword('nguoi-la@example.com');

    expect(result.message).toMatch(/if that email is registered/i);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('email có thật thì gửi link đặt lại', async () => {
    User.findOne.mockResolvedValue({ _id: USER_ID });

    await authService.forgotPassword(registration.email);

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(registration.email, expect.any(String));
  });

  it('đặt lại mật khẩu thành công thì huỷ mọi phiên đang đăng nhập', async () => {
    const token = 'reset-token';
    User.find.mockReturnValue(selectReturns([{ _id: USER_ID, resetPasswordToken: await hashToken(token) }]));

    await authService.resetPassword(token, 'MatKhauMoi1');

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ refreshTokens: [] }));
  });

  it('token đặt lại sai bị từ chối', async () => {
    User.find.mockReturnValue(selectReturns([]));

    await expect(authService.resetPassword('token-sai', 'MatKhauMoi1'))
      .rejects.toMatchObject({ code: 'RESET_TOKEN_INVALID' });
  });
});

describe('resendVerification', () => {
  it('tài khoản đã xác minh thì báo lỗi thay vì gửi lại', async () => {
    User.findOne.mockReturnValue(selectReturns({ _id: USER_ID, emailVerified: true }));

    await expect(authService.resendVerification(registration.email))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('email lạ trả thông điệp trung tính', async () => {
    User.findOne.mockReturnValue(selectReturns(null));

    const result = await authService.resendVerification('nguoi-la@example.com');

    expect(result.message).toMatch(/if that email is registered/i);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
