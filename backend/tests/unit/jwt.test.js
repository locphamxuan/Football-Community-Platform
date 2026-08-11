const jwt = require('jsonwebtoken');
const {
  generateAccessToken, generateRefreshToken,
  verifyAccessToken, verifyRefreshToken, getTokenExpiry,
} = require('../../src/utils/jwt');

const USER_ID = '000000000000000000000001';

describe('access token', () => {
  it('mang theo id, email, roles và một jti duy nhất', () => {
    const { token, jti } = generateAccessToken(USER_ID, 'probe@example.com', ['user']);
    const payload = verifyAccessToken(token);

    expect(payload).toMatchObject({ sub: USER_ID, email: 'probe@example.com', roles: ['user'], jti });
  });

  it('mỗi lần ký ra một jti khác nhau — nếu trùng, logout một phiên sẽ giết mọi phiên', () => {
    const a = generateAccessToken(USER_ID, 'probe@example.com', ['user']);
    const b = generateAccessToken(USER_ID, 'probe@example.com', ['user']);

    expect(a.jti).not.toBe(b.jti);
  });

  it('có hạn dùng', () => {
    const { token } = generateAccessToken(USER_ID, 'probe@example.com', ['user']);
    const { exp, iat } = verifyAccessToken(token);

    expect(exp).toBeGreaterThan(iat);
  });
});

describe('refresh token', () => {
  it('chỉ chứa id và jti, không mang role', () => {
    const { token } = generateRefreshToken(USER_ID);
    const payload = verifyRefreshToken(token);

    expect(payload.sub).toBe(USER_ID);
    expect(payload.roles).toBeUndefined();
  });

  it('ký bằng secret riêng nên không dùng thay access token được', () => {
    const { token } = generateRefreshToken(USER_ID);

    expect(() => verifyAccessToken(token)).toThrow();
  });
});

describe('xác minh token hỏng', () => {
  it('chuỗi rác bị từ chối', () => {
    expect(() => verifyAccessToken('khong-phai-token')).toThrow();
  });

  it('token hết hạn bị từ chối', () => {
    const expired = jwt.sign({ sub: USER_ID }, process.env.JWT_ACCESS_SECRET, { expiresIn: '-1s' });

    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });
});

describe('getTokenExpiry', () => {
  it.each([
    ['15m', 15 * 60 * 1000],
    ['7d', 7 * 86400000],
    ['30s', 30 * 1000],
    ['2h', 2 * 3600000],
  ])('%s được quy đổi đúng', (input, ms) => {
    const before = Date.now();
    const expiry = getTokenExpiry(input).getTime();

    expect(expiry - before).toBeGreaterThanOrEqual(ms - 50);
    expect(expiry - before).toBeLessThanOrEqual(ms + 50);
  });

  it('chuỗi không hiểu được coi như hết hạn ngay', () => {
    expect(getTokenExpiry('mãi mãi').getTime()).toBeLessThanOrEqual(Date.now());
  });
});
