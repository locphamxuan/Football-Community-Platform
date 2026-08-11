jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/auth.service');

const request = require('supertest');
const app = require('../../src/app');
const authService = require('../../src/services/auth.service');
const { asUser } = require('../helpers/auth');

const validRegistration = {
  email: 'probe@example.com',
  password: 'Probe1234',
  username: 'probe_user',
  fullName: 'Probe User',
};

describe('POST /api/v1/auth/register', () => {
  it('tạo tài khoản và trả 201', async () => {
    authService.register.mockResolvedValue({ message: 'Check your email' });

    const res = await request(app).post('/api/v1/auth/register').send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, message: 'Check your email' });
    expect(authService.register).toHaveBeenCalledWith(expect.objectContaining({ username: 'probe_user' }));
  });

  it('hạ email và username về chữ thường trước khi vào service', async () => {
    authService.register.mockResolvedValue({ message: 'ok' });

    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'Probe@Example.COM', username: 'Probe_User' });

    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'probe@example.com', username: 'probe_user' })
    );
  });

  it.each([
    ['email sai định dạng', { email: 'not-an-email' }],
    ['mật khẩu dưới 8 ký tự', { password: 'Ab1' }],
    ['mật khẩu không có chữ hoa', { password: 'probe1234' }],
    ['mật khẩu không có số', { password: 'ProbePassword' }],
    ['username có ký tự lạ', { username: 'probe user!' }],
    ['số điện thoại không phải VN', { phone: '12345' }],
  ])('từ chối khi %s', async (_label, patch) => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, ...patch });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(authService.register).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/login', () => {
  it('trả access token và đặt refresh token vào cookie httpOnly', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: '1', email: 'probe@example.com' },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'probe@example.com', password: 'Probe1234' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('access-token');
    // Refresh token không được lộ trong body — chỉ nằm trong cookie httpOnly
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.headers['set-cookie'].join()).toMatch(/refreshToken=refresh-token;.*HttpOnly/i);
  });

  it('thiếu mật khẩu thì trả 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'probe@example.com' });
    expect(res.status).toBe(400);
    expect(authService.login).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/refresh-token', () => {
  it('không có token thì trả 401', async () => {
    const res = await request(app).post('/api/v1/auth/refresh-token').send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('đọc token từ cookie', async () => {
    authService.refreshToken.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', ['refreshToken=from-cookie']);

    expect(res.status).toBe(200);
    expect(authService.refreshToken).toHaveBeenCalledWith('from-cookie', expect.any(String), expect.any(String));
  });

  it('đọc token từ body khi không có cookie', async () => {
    authService.refreshToken.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken: 'from-body' });

    expect(authService.refreshToken).toHaveBeenCalledWith('from-body', expect.any(String), expect.any(String));
  });
});

describe('các endpoint email', () => {
  it('GET /verify-email/:token chuyển token cho service', async () => {
    authService.verifyEmail.mockResolvedValue({ message: 'Email verified' });

    const res = await request(app).get('/api/v1/auth/verify-email/abc123');

    expect(res.status).toBe(200);
    expect(authService.verifyEmail).toHaveBeenCalledWith('abc123');
  });

  it('POST /resend-verification cần email hợp lệ', async () => {
    const res = await request(app).post('/api/v1/auth/resend-verification').send({ email: 'nope' });
    expect(res.status).toBe(400);
  });

  it('POST /forgot-password nhận email hợp lệ', async () => {
    authService.forgotPassword.mockResolvedValue({ message: 'Reset link sent' });

    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'probe@example.com' });

    expect(res.status).toBe(200);
    expect(authService.forgotPassword).toHaveBeenCalledWith('probe@example.com');
  });

  it('POST /reset-password từ chối mật khẩu yếu', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'reset-token', password: 'weak' });

    expect(res.status).toBe(400);
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('POST /reset-password chuyển token và mật khẩu mới cho service', async () => {
    authService.resetPassword.mockResolvedValue({ message: 'Password updated' });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'reset-token', password: 'Probe1234' });

    expect(res.status).toBe(200);
    expect(authService.resetPassword).toHaveBeenCalledWith('reset-token', 'Probe1234');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('cần đăng nhập', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });

  it('thu hồi token và xoá cookie', async () => {
    authService.logout.mockResolvedValue(undefined);
    const headers = asUser();

    const res = await request(app).post('/api/v1/auth/logout').set(headers);

    expect(res.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith(
      expect.any(String),
      headers.Authorization.replace('Bearer ', '')
    );
    expect(res.headers['set-cookie'].join()).toMatch(/refreshToken=;/);
  });
});
