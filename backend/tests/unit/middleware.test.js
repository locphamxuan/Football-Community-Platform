jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));

const { z } = require('zod');
const mongoose = require('mongoose');
const authenticate = require('../../src/middleware/authenticate');
const authorize = require('../../src/middleware/authorize');
const validate = require('../../src/middleware/validate');
const parseJsonFields = require('../../src/middleware/parseJsonFields');
const { AppError, errorHandler } = require('../../src/middleware/errorHandler');
const catchAsync = require('../../src/utils/catchAsync');
const { getPagination } = require('../../src/utils/pagination');
const { generateAccessToken } = require('../../src/utils/jwt');
const { cache, CacheKeys, resetCache } = require('../helpers/fakeRedis');
const Role = require('../../src/constants/roles');

const fakeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

/** Thân response cuối cùng mà middleware đã gửi. */
const bodyOf = (res) => res.json.mock.calls[0][0];

beforeEach(resetCache);

describe('authenticate', () => {
  const USER_ID = '000000000000000000000001';

  it('không có header Authorization thì trả 401', async () => {
    const res = fakeRes();
    const next = jest.fn();

    await authenticate({ headers: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(bodyOf(res).code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('header không bắt đầu bằng "Bearer " cũng bị chặn', async () => {
    const res = fakeRes();

    await authenticate({ headers: { authorization: 'Basic abc' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('token hợp lệ thì gắn req.user và đi tiếp', async () => {
    const { token } = generateAccessToken(USER_ID, 'probe@example.com', [Role.USER]);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();

    await authenticate(req, fakeRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: USER_ID, email: 'probe@example.com', roles: [Role.USER] });
  });

  it('không có header thì rơi về cookie accessToken (web)', async () => {
    const { token } = generateAccessToken(USER_ID, 'probe@example.com', [Role.USER]);
    const req = { headers: {}, cookies: { accessToken: token } };
    const next = jest.fn();

    await authenticate(req, fakeRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: USER_ID, email: 'probe@example.com', roles: [Role.USER] });
  });

  it('có cả header lẫn cookie thì header thắng', async () => {
    const header = generateAccessToken(USER_ID, 'probe@example.com', [Role.USER]).token;
    const cookie = generateAccessToken('000000000000000000000002', 'khac@example.com', [Role.USER]).token;
    const req = { headers: { authorization: `Bearer ${header}` }, cookies: { accessToken: cookie } };
    const next = jest.fn();

    await authenticate(req, fakeRes(), next);

    expect(req.user.id).toBe(USER_ID);
  });

  it('token đã logout (nằm trong blacklist) bị từ chối', async () => {
    const { token, jti } = generateAccessToken(USER_ID, 'probe@example.com', [Role.USER]);
    await cache.set(CacheKeys.blacklistedToken(jti), '1');
    const res = fakeRes();
    const next = jest.fn();

    await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(bodyOf(res).code).toBe('TOKEN_INVALID');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authorize', () => {
  it('chưa đăng nhập thì trả 401 chứ không phải 403', () => {
    const res = fakeRes();

    authorize(Role.ADMIN)({}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('thiếu vai trò thì trả 403', () => {
    const res = fakeRes();
    const next = jest.fn();

    authorize(Role.ADMIN)({ user: { roles: [Role.USER] } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(bodyOf(res).code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('chỉ cần khớp một trong các vai trò cho phép', () => {
    const next = jest.fn();

    authorize(Role.FIELD_OWNER, Role.ADMIN)({ user: { roles: [Role.USER, Role.ADMIN] } }, fakeRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('validate', () => {
  const schema = z.object({ age: z.coerce.number().int().min(1), name: z.string().min(2) });

  it('ghi đè req.body bằng dữ liệu đã ép kiểu', () => {
    const req = { body: { age: '30', name: 'Probe', thua: 'bi loai' } };
    const next = jest.fn();

    validate(schema)(req, fakeRes(), next);

    expect(next).toHaveBeenCalled();
    // Zod loại field lạ — service không bao giờ thấy dữ liệu ngoài hợp đồng
    expect(req.body).toEqual({ age: 30, name: 'Probe' });
  });

  it('gom lỗi theo từng field', () => {
    const res = fakeRes();

    validate(schema)({ body: { age: 0, name: 'x' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Object.keys(bodyOf(res).errors)).toEqual(expect.arrayContaining(['age', 'name']));
  });

  it('validate được cả query', () => {
    const req = { query: { age: '5', name: 'Probe' } };

    validate(schema, 'query')(req, fakeRes(), jest.fn());

    expect(req.query.age).toBe(5);
  });

  it('lỗi ở gốc object được gắn khoá "value"', () => {
    const refined = z.object({ a: z.number() }).refine(() => false, { message: 'Sai toàn cục' });
    const res = fakeRes();

    validate(refined)({ body: { a: 1 } }, res, jest.fn());

    expect(bodyOf(res).errors).toHaveProperty('value');
  });
});

describe('parseJsonFields', () => {
  it('giải mã chuỗi JSON của multipart', () => {
    const req = { body: { location: '{"city":"Hà Nội"}', name: 'Sân Probe' } };
    const next = jest.fn();

    parseJsonFields(['location'])(req, fakeRes(), next);

    expect(req.body.location).toEqual({ city: 'Hà Nội' });
    expect(req.body.name).toBe('Sân Probe');
    expect(next).toHaveBeenCalled();
  });

  it('bỏ qua field vắng mặt hoặc rỗng', () => {
    const req = { body: { location: '' } };
    const next = jest.fn();

    parseJsonFields(['location', 'pricing'])(req, fakeRes(), next);

    expect(req.body.location).toBe('');
    expect(next).toHaveBeenCalled();
  });

  it('không đụng tới giá trị đã là object (request JSON thuần)', () => {
    const req = { body: { pricing: { weekday: 1 } } };

    parseJsonFields(['pricing'])(req, fakeRes(), jest.fn());

    expect(req.body.pricing).toEqual({ weekday: 1 });
  });

  it('báo 400 kèm tên field khi JSON hỏng', () => {
    const res = fakeRes();
    const next = jest.fn();

    parseJsonFields(['location'])({ body: { location: '{hong' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bodyOf(res).errors).toHaveProperty('location');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('errorHandler', () => {
  it('AppError giữ nguyên status và code do service đặt', () => {
    const res = fakeRes();

    errorHandler(new AppError('Hết hạn mức gói', 402, 'PLAN_LIMIT_REACHED'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(402);
    expect(bodyOf(res)).toMatchObject({ message: 'Hết hạn mức gói', code: 'PLAN_LIMIT_REACHED' });
  });

  it('trùng khoá của Mongo thành 409 kèm tên field', () => {
    const res = fakeRes();
    const err = Object.assign(new Error('E11000'), { code: 11000, keyValue: { email: 'a@b.c' } });

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(bodyOf(res).message).toMatch(/email/);
  });

  it('ObjectId sai định dạng thành 400', () => {
    const res = fakeRes();
    const err = new mongoose.Error.CastError('ObjectId', 'khong-phai-id', '_id');

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bodyOf(res).code).toBe('VALIDATION_ERROR');
  });

  it('lỗi lạ trả 500 và không lộ chi tiết ra ngoài', () => {
    const res = fakeRes();

    errorHandler(new Error('connect ECONNREFUSED 10.0.0.1:27017'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(bodyOf(res).message).toBe('An unexpected error occurred');
  });
});

describe('catchAsync', () => {
  it('chuyển lỗi async sang next thay vì để promise treo', async () => {
    const boom = new Error('bùm');
    const next = jest.fn();

    await catchAsync(async () => { throw boom; })({}, fakeRes(), next);

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('không gọi next khi handler chạy trót lọt', async () => {
    const next = jest.fn();

    await catchAsync(async () => 'ok')({}, fakeRes(), next);

    expect(next).not.toHaveBeenCalled();
  });
});

describe('getPagination', () => {
  it('mặc định trang 1, 10 bản ghi', () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('chặn limit trên 100 để một request không kéo cả bảng', () => {
    expect(getPagination({ limit: '5000' }).limit).toBe(100);
  });

  it('page và limit không hợp lệ rơi về mặc định', () => {
    expect(getPagination({ page: '-3', limit: '0' })).toEqual({ page: 1, limit: 10, skip: 0 });
    expect(getPagination({ page: 'abc' }).page).toBe(1);
  });

  it('tính skip theo trang', () => {
    expect(getPagination({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
  });
});
