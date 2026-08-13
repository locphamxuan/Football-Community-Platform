/**
 * Đặt hạn mức thấp TRƯỚC khi nạp middleware — config/env đọc process.env ngay
 * lúc require, nên phải gán ở đây chứ không phải trong beforeEach.
 */
process.env.RATE_LIMIT_MAX = '3';
process.env.RATE_LIMIT_AUTH_MAX = '2';
process.env.RATE_LIMIT_WRITE_MAX = '2';
process.env.RATE_LIMIT_UPLOAD_MAX = '2';
process.env.RATE_LIMIT_USE_REDIS = 'false';

const express = require('express');
const request = require('supertest');

/**
 * Mỗi limiter giữ bộ đếm riêng bên trong module, nên hai test dùng chung một
 * instance sẽ cộng dồn lượt của nhau. Nạp lại module cho từng test để mỗi test
 * bắt đầu từ số 0.
 */
const freshLimiters = () => {
  let limiters;
  jest.isolateModules(() => { limiters = require('../../src/middleware/rateLimiter'); });
  return limiters;
};

/** App tối giản chỉ để bắn request qua đúng một limiter. */
const appUsing = (limiter) => {
  const app = express();
  app.use(limiter);
  app.all('/probe', (_req, res) => res.json({ ok: true }));
  return app;
};

const appWith = (name) => appUsing(freshLimiters()[name]);

const hit = (app, times, method = 'get') => {
  const run = async () => {
    let last;
    for (let i = 0; i < times; i += 1) {
      // Tuần tự: bộ đếm phải tăng theo thứ tự thì mới khẳng định được lần thứ n bị chặn
      // eslint-disable-next-line no-await-in-loop
      last = await request(app)[method]('/probe');
    }
    return last;
  };
  return run();
};

describe('globalLimiter', () => {
  it('cho qua trong hạn mức', async () => {
    const res = await hit(appWith('globalLimiter'), 3);
    expect(res.status).toBe(200);
  });

  it('vượt hạn mức thì trả 429 đúng khuôn dạng lỗi chung', async () => {
    const res = await hit(appWith('globalLimiter'), 4);

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, code: 'TOO_MANY_REQUESTS' });
    expect(res.body.message).toMatch(/too many requests/i);
  });

  it('gửi kèm header RateLimit chuẩn để client tự giãn nhịp', async () => {
    const res = await hit(appWith('globalLimiter'), 1);

    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).not.toHaveProperty('x-ratelimit-limit');
  });
});

describe('writeLimiter', () => {
  it('không tính lượt cho request đọc', async () => {
    const res = await hit(appWith('writeLimiter'), 10, 'get');
    expect(res.status).toBe(200);
  });

  it('chặn khi ghi quá nhanh', async () => {
    const res = await hit(appWith('writeLimiter'), 3, 'post');

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/write/i);
  });

  it('đọc không làm cạn hạn mức ghi', async () => {
    const app = appWith('writeLimiter');

    await hit(app, 5, 'get');
    const res = await hit(app, 2, 'post');

    expect(res.status).toBe(200);
  });
});

describe('authLimiter', () => {
  it('ngưỡng thấp hơn hẳn để chặn dò mật khẩu', async () => {
    const res = await hit(appWith('authLimiter'), 3, 'post');

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/15 minutes/i);
  });
});

describe('uploadLimiter', () => {
  it('chặn upload dồn dập bằng cùng một khuôn dạng lỗi', async () => {
    const res = await hit(appWith('uploadLimiter'), 3, 'post');

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('khoá đếm', () => {
  const { generateAccessToken } = require('../../src/utils/jwt');

  const hitAs = (app, token, times, method = 'post') => {
    const run = async () => {
      let last;
      for (let i = 0; i < times; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        last = await request(app)[method]('/probe').set('Authorization', `Bearer ${token}`);
      }
      return last;
    };
    return run();
  };

  // Cả một văn phòng hay cả một trạm 4G dùng chung IP công cộng; đếm theo IP là để
  // vài người dùng bình thường làm cạn hạn mức của tất cả những người còn lại.
  it('hai tài khoản trên cùng một IP không tiêu hạn mức của nhau', async () => {
    const app = appWith('writeLimiter');
    const { token: a } = generateAccessToken('000000000000000000000001', 'a@probe.vn', ['user']);
    const { token: b } = generateAccessToken('000000000000000000000002', 'b@probe.vn', ['user']);

    await hitAs(app, a, 2);
    const res = await hitAs(app, b, 2);

    expect(res.status).toBe(200);
  });

  it('cùng một tài khoản vẫn bị chặn khi vượt hạn mức', async () => {
    const app = appWith('writeLimiter');
    const { token } = generateAccessToken('000000000000000000000001', 'a@probe.vn', ['user']);

    const res = await hitAs(app, token, 3);

    expect(res.status).toBe(429);
  });

  // Tin `sub` trong một token bịa là mở cửa cho hạn mức vô hạn: đổi token mỗi request.
  it('token giả không mở được khoá đếm mới, vẫn đếm theo IP', async () => {
    const app = appWith('writeLimiter');
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJrZS1naWEifQ.chu-ky-bia';

    await hitAs(app, forged, 2);
    const res = await hitAs(app, 'mot-token-bia-khac', 1);

    expect(res.status).toBe(429);
  });
});

describe('mỗi limiter đếm riêng', () => {
  it('cạn hạn mức auth không kéo theo limiter upload', async () => {
    // Cùng một lần nạp module: nếu hai limiter dùng chung bộ đếm thì lỗi lộ ra đây
    const { authLimiter, uploadLimiter } = freshLimiters();

    await hit(appUsing(authLimiter), 5, 'post');
    const res = await hit(appUsing(uploadLimiter), 1, 'post');

    expect(res.status).toBe(200);
  });
});
