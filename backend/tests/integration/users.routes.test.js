jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/user.service');

const request = require('supertest');
const app = require('../../src/app');
const userService = require('../../src/services/user.service');
const { asUser, USER_ID } = require('../helpers/auth');

describe('toàn bộ /api/v1/users cần đăng nhập', () => {
  it.each([
    ['get', '/api/v1/users/me'],
    ['patch', '/api/v1/users/me'],
    ['patch', '/api/v1/users/me/password'],
    ['patch', '/api/v1/users/me/avatar'],
    ['patch', '/api/v1/users/me/notifications'],
    ['get', '/api/v1/users/000000000000000000000002'],
    ['get', '/api/v1/users/search'],
    ['post', '/api/v1/users/me/push-tokens'],
    ['delete', '/api/v1/users/me/push-tokens'],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/v1/users/me', () => {
  it('trả hồ sơ của chính người đang đăng nhập', async () => {
    userService.getMe.mockResolvedValue({ _id: USER_ID, username: 'probe' });

    const res = await request(app).get('/api/v1/users/me').set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('probe');
    expect(userService.getMe).toHaveBeenCalledWith(USER_ID);
  });
});

describe('PATCH /api/v1/users/me', () => {
  it('cập nhật hồ sơ', async () => {
    userService.updateProfile.mockResolvedValue({ fullName: 'Probe Updated' });

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(asUser())
      .send({ fullName: 'Probe Updated', gender: 'male' });

    expect(res.status).toBe(200);
    expect(userService.updateProfile).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ fullName: 'Probe Updated', gender: 'male' })
    );
  });

  it.each([
    ['số điện thoại không phải VN', { phone: '0000' }],
    ['giới tính ngoài danh sách', { gender: 'unknown' }],
    ['vị trí thi đấu không hợp lệ', { playerProfile: { positions: ['striker'] } }],
  ])('từ chối khi %s', async (_label, patch) => {
    const res = await request(app).patch('/api/v1/users/me').set(asUser()).send(patch);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(userService.updateProfile).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/users/me/notifications', () => {
  it('tắt một loại thông báo', async () => {
    userService.updateNotificationPrefs.mockResolvedValue({ _id: USER_ID });

    const res = await request(app)
      .patch('/api/v1/users/me/notifications')
      .set(asUser())
      .send({ push: false, mutedTypes: ['invoice_issued'] });

    expect(res.status).toBe(200);
    expect(userService.updateNotificationPrefs).toHaveBeenCalledWith(
      USER_ID,
      { push: false, mutedTypes: ['invoice_issued'] }
    );
  });

  it.each([
    ['loại thông báo không có thật', { mutedTypes: ['world_cup_final'] }],
    ['công tắc đẩy không phải boolean', { push: 'yes' }],
  ])('trả 400 khi %s', async (_label, body) => {
    const res = await request(app)
      .patch('/api/v1/users/me/notifications')
      .set(asUser())
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(userService.updateNotificationPrefs).not.toHaveBeenCalled();
  });

  it('không nhận tuỳ chọn thông báo qua PATCH /me — nơi đó ghi đè cả cụm', async () => {
    userService.updateProfile.mockResolvedValue({});

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(asUser())
      .send({ notifications: { push: false } });

    expect(res.status).toBe(200);
    expect(userService.updateProfile).toHaveBeenCalledWith(
      USER_ID,
      expect.not.objectContaining({ notifications: expect.anything() })
    );
  });
});

describe('PATCH /api/v1/users/me/password', () => {
  it('đổi mật khẩu khi xác nhận khớp', async () => {
    userService.changePassword.mockResolvedValue({ message: 'Password changed' });

    const res = await request(app).patch('/api/v1/users/me/password').set(asUser()).send({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password changed');
  });

  it('từ chối khi xác nhận không khớp', async () => {
    const res = await request(app).patch('/api/v1/users/me/password').set(asUser()).send({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'Different123',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('confirmPassword');
    expect(userService.changePassword).not.toHaveBeenCalled();
  });

  it('từ chối mật khẩu mới quá yếu', async () => {
    const res = await request(app).patch('/api/v1/users/me/password').set(asUser()).send({
      currentPassword: 'OldPass123',
      newPassword: 'weak',
      confirmPassword: 'weak',
    });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/users/me/avatar', () => {
  it('báo lỗi khi không gửi kèm file', async () => {
    const res = await request(app).patch('/api/v1/users/me/avatar').set(asUser());

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/image file/i);
    expect(userService.updateAvatar).not.toHaveBeenCalled();
  });

  it('nhận ảnh và chuyển cho service', async () => {
    userService.updateAvatar.mockResolvedValue({ avatar: 'https://cdn/probe.png' });

    const res = await request(app)
      .patch('/api/v1/users/me/avatar')
      .set(asUser())
      .attach('image', Buffer.from('fake-png'), { filename: 'probe.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(userService.updateAvatar).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ originalname: 'probe.png' }));
  });

  it('từ chối file không phải ảnh', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/avatar')
      .set(asUser())
      .attach('image', Buffer.from('not-an-image'), { filename: 'probe.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(userService.updateAvatar).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/users/:id', () => {
  it('trả hồ sơ công khai của người khác', async () => {
    userService.getUserById.mockResolvedValue({ username: 'someone-else' });

    const res = await request(app).get('/api/v1/users/000000000000000000000002').set(asUser());

    expect(res.status).toBe(200);
    expect(userService.getUserById).toHaveBeenCalledWith('000000000000000000000002');
  });
});

describe('GET /api/v1/users/search', () => {
  it('trả danh sách người có thể nhắn tin', async () => {
    userService.searchChatPartners.mockResolvedValue({ users: [{ username: 'nam' }] });

    const res = await request(app).get('/api/v1/users/search').query({ q: 'nam' }).set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(userService.searchChatPartners).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ q: 'nam' }));
  });

  it.each([
    ['thiếu từ khoá', {}],
    ['từ khoá quá ngắn', { q: 'n' }],
    ['limit vượt trần', { q: 'nam', limit: 100 }],
  ])('trả 400 khi %s', async (_label, query) => {
    const res = await request(app).get('/api/v1/users/search').query(query).set(asUser());

    expect(res.status).toBe(400);
    expect(userService.searchChatPartners).not.toHaveBeenCalled();
  });
});

describe('thiết bị nhận thông báo đẩy', () => {
  const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';

  it('đăng ký thiết bị', async () => {
    userService.addPushToken.mockResolvedValue({ devices: 1 });

    const res = await request(app)
      .post('/api/v1/users/me/push-tokens')
      .set(asUser())
      .send({ token: TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.data.devices).toBe(1);
    expect(userService.addPushToken).toHaveBeenCalledWith(USER_ID, TOKEN);
  });

  it('gỡ thiết bị lúc đăng xuất', async () => {
    userService.removePushToken.mockResolvedValue({ devices: 0 });

    const res = await request(app)
      .delete('/api/v1/users/me/push-tokens')
      .set(asUser())
      .send({ token: TOKEN });

    expect(res.status).toBe(200);
    expect(userService.removePushToken).toHaveBeenCalledWith(USER_ID, TOKEN);
  });

  it.each([
    ['token của Firebase chứ không phải Expo', { token: 'fcm-abc' }],
    ['thiếu token', {}],
  ])('trả 400 khi %s', async (_label, body) => {
    const res = await request(app).post('/api/v1/users/me/push-tokens').set(asUser()).send(body);

    expect(res.status).toBe(400);
    expect(userService.addPushToken).not.toHaveBeenCalled();
  });
});
