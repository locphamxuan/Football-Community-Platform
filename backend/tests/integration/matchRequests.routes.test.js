jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/matchRequest.service');

const request = require('supertest');
const app = require('../../src/app');
const matchRequestService = require('../../src/services/matchRequest.service');
const { asUser, USER_ID } = require('../helpers/auth');

const REQUEST_ID = '000000000000000000000040';
const MY_TEAM = '000000000000000000000030';
const RIVAL_TEAM = '000000000000000000000031';

const futureDate = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

const validRequest = () => ({
  requesterTeamId: MY_TEAM,
  opponentTeamId: RIVAL_TEAM,
  date: futureDate(),
  startTime: '18:00',
  endTime: '20:00',
  fieldSize: '7v7',
});

describe('toàn bộ /api/v1/match-requests cần đăng nhập', () => {
  it.each([
    ['post', '/api/v1/match-requests'],
    ['get', '/api/v1/match-requests'],
    ['get', `/api/v1/match-requests/${REQUEST_ID}`],
    ['patch', `/api/v1/match-requests/${REQUEST_ID}/respond`],
    ['patch', `/api/v1/match-requests/${REQUEST_ID}/cancel`],
    ['patch', `/api/v1/match-requests/${REQUEST_ID}/result`],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/match-requests', () => {
  it('gửi lời mời thi đấu', async () => {
    matchRequestService.createMatchRequest.mockResolvedValue({ _id: REQUEST_ID });

    const res = await request(app).post('/api/v1/match-requests').set(asUser()).send(validRequest());

    expect(res.status).toBe(201);
    expect(matchRequestService.createMatchRequest).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ requesterTeamId: MY_TEAM, opponentTeamId: RIVAL_TEAM })
    );
  });

  it('giữ lại requesterTeamId — thiếu nó service không biết đội nào mời', async () => {
    const body = validRequest();
    delete body.requesterTeamId;

    const res = await request(app).post('/api/v1/match-requests').set(asUser()).send(body);

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('requesterTeamId');
  });

  it.each([
    ['ngày đã qua', { date: '2020-01-01' }],
    ['giờ kết thúc trước giờ bắt đầu', { startTime: '20:00', endTime: '18:00' }],
    ['cỡ sân không hợp lệ', { fieldSize: '9v9' }],
  ])('từ chối khi %s', async (_label, patch) => {
    const res = await request(app)
      .post('/api/v1/match-requests')
      .set(asUser())
      .send({ ...validRequest(), ...patch });

    expect(res.status).toBe(400);
    expect(matchRequestService.createMatchRequest).not.toHaveBeenCalled();
  });
});

describe('phản hồi lời mời', () => {
  it('chấp nhận', async () => {
    matchRequestService.respondToRequest.mockResolvedValue({ status: 'accepted' });

    const res = await request(app)
      .patch(`/api/v1/match-requests/${REQUEST_ID}/respond`)
      .set(asUser())
      .send({ accept: true });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Request accepted');
    expect(matchRequestService.respondToRequest).toHaveBeenCalledWith(REQUEST_ID, USER_ID, true);
  });

  it('từ chối', async () => {
    matchRequestService.respondToRequest.mockResolvedValue({ status: 'rejected' });

    const res = await request(app)
      .patch(`/api/v1/match-requests/${REQUEST_ID}/respond`)
      .set(asUser())
      .send({ accept: false });

    expect(res.body.message).toBe('Request rejected');
  });

  it('accept phải là boolean thật, không nhận chuỗi', async () => {
    const res = await request(app)
      .patch(`/api/v1/match-requests/${REQUEST_ID}/respond`)
      .set(asUser())
      .send({ accept: 'true' });

    expect(res.status).toBe(400);
    expect(matchRequestService.respondToRequest).not.toHaveBeenCalled();
  });
});

describe('huỷ và nhập kết quả', () => {
  it('huỷ lời mời', async () => {
    matchRequestService.cancelRequest.mockResolvedValue({ status: 'cancelled' });

    const res = await request(app).patch(`/api/v1/match-requests/${REQUEST_ID}/cancel`).set(asUser());

    expect(res.status).toBe(200);
    expect(matchRequestService.cancelRequest).toHaveBeenCalledWith(REQUEST_ID, USER_ID);
  });

  it('nhập tỉ số', async () => {
    matchRequestService.submitResult.mockResolvedValue({ status: 'completed' });

    const res = await request(app)
      .patch(`/api/v1/match-requests/${REQUEST_ID}/result`)
      .set(asUser())
      .send({ requesterScore: 3, opponentScore: 1 });

    expect(res.status).toBe(200);
    expect(matchRequestService.submitResult).toHaveBeenCalledWith(
      REQUEST_ID, USER_ID, { requesterScore: 3, opponentScore: 1 }
    );
  });

  it.each([
    ['tỉ số âm', { requesterScore: -1, opponentScore: 0 }],
    ['tỉ số không nguyên', { requesterScore: 1.5, opponentScore: 0 }],
    ['thiếu một bên', { requesterScore: 2 }],
  ])('từ chối khi %s', async (_label, body) => {
    const res = await request(app).patch(`/api/v1/match-requests/${REQUEST_ID}/result`).set(asUser()).send(body);

    expect(res.status).toBe(400);
    expect(matchRequestService.submitResult).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/match-requests', () => {
  it('trả danh sách kèm phân trang', async () => {
    matchRequestService.getMatchRequests.mockResolvedValue({ requests: [], total: 3, page: 1, limit: 10 });

    const res = await request(app).get('/api/v1/match-requests').query({ status: 'pending' }).set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.meta.pagination.total).toBe(3);
    expect(matchRequestService.getMatchRequests).toHaveBeenCalledWith(
      USER_ID, expect.objectContaining({ status: 'pending' })
    );
  });
});
