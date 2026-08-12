jest.mock('../../src/models/User', () => ({ findByIdAndUpdate: jest.fn() }));

const User = require('../../src/models/User');
const { sendExpoPush, isExpoPushToken } = require('../../src/services/push.service');

const USER_ID = '000000000000000000000001';
const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

const makeUser = (overrides = {}) => ({
  _id: USER_ID,
  expoPushTokens: [TOKEN_A],
  notifications: { push: true },
  ...overrides,
});

const mockExpoReply = (data) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) });
};

const payload = { title: 'Lịch đặt đã được xác nhận', body: 'Sân Probe', link: '/bookings' };

beforeEach(() => {
  User.findByIdAndUpdate.mockResolvedValue({});
  mockExpoReply([{ status: 'ok' }]);
});

afterEach(() => {
  delete global.fetch;
});

describe('isExpoPushToken', () => {
  it.each([
    ['ExponentPushToken[abc]', true],
    ['ExpoPushToken[abc]', true],
    ['fcm-token-cua-firebase', false],
    ['ExponentPushToken[]', false],
    ['', false],
  ])('%s → %s', (token, expected) => {
    expect(isExpoPushToken(token)).toBe(expected);
  });
});

describe('sendExpoPush', () => {
  it('gửi tới mọi thiết bị của người dùng', async () => {
    mockExpoReply([{ status: 'ok' }, { status: 'ok' }]);

    const result = await sendExpoPush(makeUser({ expoPushTokens: [TOKEN_A, TOKEN_B] }), payload);

    expect(result.sent).toBe(2);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ to: TOKEN_A, title: payload.title, data: { link: '/bookings' } });
  });

  it('không gọi mạng khi người dùng chưa đăng ký thiết bị nào', async () => {
    const result = await sendExpoPush(makeUser({ expoPushTokens: [] }), payload);

    expect(result.sent).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('tôn trọng cờ tắt thông báo đẩy trong hồ sơ', async () => {
    await sendExpoPush(makeUser({ notifications: { push: false } }), payload);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('bỏ qua token không phải của Expo, không gửi rác lên server họ', async () => {
    await sendExpoPush(makeUser({ expoPushTokens: ['fcm-token-la'] }), payload);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('xoá token của thiết bị đã gỡ app — giữ lại chỉ làm mọi lần gửi sau đều hỏng', async () => {
    mockExpoReply([
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok' },
    ]);

    await sendExpoPush(makeUser({ expoPushTokens: [TOKEN_A, TOKEN_B] }), payload);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { $pull: { expoPushTokens: { $in: [TOKEN_A] } } }
    );
  });

  it('Expo chết thì không ném lỗi — hành động gốc đã xong rồi', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

    await expect(sendExpoPush(makeUser(), payload)).resolves.toEqual({ sent: 0 });
  });

  it('Expo trả HTTP lỗi thì cũng không ném', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    await expect(sendExpoPush(makeUser(), payload)).resolves.toEqual({ sent: 0 });
  });
});
