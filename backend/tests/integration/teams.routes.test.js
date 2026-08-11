jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/team.service');

const request = require('supertest');
const app = require('../../src/app');
const teamService = require('../../src/services/team.service');
const { asUser, USER_ID } = require('../helpers/auth');

const TEAM_ID = '000000000000000000000030';
const MEMBER_ID = '000000000000000000000031';

describe('các endpoint công khai', () => {
  it('GET /teams không cần đăng nhập', async () => {
    teamService.getTeams.mockResolvedValue({ teams: [], total: 0, page: 1, limit: 10 });

    const res = await request(app).get('/api/v1/teams');

    expect(res.status).toBe(200);
  });

  it('GET /teams/:id không cần đăng nhập', async () => {
    teamService.getTeamById.mockResolvedValue({ _id: TEAM_ID, name: 'Probe FC' });

    const res = await request(app).get(`/api/v1/teams/${TEAM_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.team.name).toBe('Probe FC');
  });
});

describe('các endpoint cần đăng nhập', () => {
  it.each([
    ['get', '/api/v1/teams/me/my-teams'],
    ['get', '/api/v1/teams/me/dashboard'],
    ['post', '/api/v1/teams'],
    ['patch', `/api/v1/teams/${TEAM_ID}`],
    ['delete', `/api/v1/teams/${TEAM_ID}`],
    ['post', `/api/v1/teams/${TEAM_ID}/join`],
    ['post', `/api/v1/teams/${TEAM_ID}/leave`],
    ['post', `/api/v1/teams/${TEAM_ID}/transfer-management`],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/teams', () => {
  it('tạo đội qua multipart và ép "false" về boolean', async () => {
    teamService.createTeam.mockResolvedValue({ _id: TEAM_ID, name: 'Probe FC' });

    const res = await request(app)
      .post('/api/v1/teams')
      .set(asUser())
      .field('name', 'Probe FC')
      .field('isPublic', 'false')
      .field('maxMembers', '20');

    expect(res.status).toBe(201);
    expect(teamService.createTeam).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ name: 'Probe FC', isPublic: false, maxMembers: 20 }),
      undefined
    );
  });

  it.each([
    ['tên dưới 3 ký tự', { name: 'FC' }],
    ['isPublic không phải boolean', { name: 'Probe FC', isPublic: 'yes' }],
    ['trình độ ngoài danh sách', { name: 'Probe FC', skillLevel: 'legendary' }],
    ['số thành viên vượt trần', { name: 'Probe FC', maxMembers: '50' }],
  ])('từ chối khi %s', async (_label, fields) => {
    let req = request(app).post('/api/v1/teams').set(asUser());
    Object.entries(fields).forEach(([key, value]) => { req = req.field(key, String(value)); });

    const res = await req;

    expect(res.status).toBe(400);
    expect(teamService.createTeam).not.toHaveBeenCalled();
  });
});

describe('thành viên và mã mời', () => {
  it('vào đội bằng mã mời', async () => {
    teamService.joinTeam.mockResolvedValue({ _id: TEAM_ID });

    const res = await request(app)
      .post(`/api/v1/teams/${TEAM_ID}/join`)
      .set(asUser())
      .send({ inviteCode: 'PROBE123' });

    expect(res.status).toBe(200);
    expect(teamService.joinTeam).toHaveBeenCalledWith(TEAM_ID, USER_ID, 'PROBE123');
  });

  it('thiếu mã mời thì từ chối', async () => {
    const res = await request(app).post(`/api/v1/teams/${TEAM_ID}/join`).set(asUser()).send({});

    expect(res.status).toBe(400);
    expect(teamService.joinTeam).not.toHaveBeenCalled();
  });

  it('rời đội', async () => {
    teamService.leaveTeam.mockResolvedValue(undefined);

    const res = await request(app).post(`/api/v1/teams/${TEAM_ID}/leave`).set(asUser());

    expect(res.status).toBe(200);
    expect(teamService.leaveTeam).toHaveBeenCalledWith(TEAM_ID, USER_ID);
  });

  it('gỡ thành viên', async () => {
    teamService.removeMember.mockResolvedValue({ _id: TEAM_ID });

    const res = await request(app).delete(`/api/v1/teams/${TEAM_ID}/members/${MEMBER_ID}`).set(asUser());

    expect(res.status).toBe(200);
    expect(teamService.removeMember).toHaveBeenCalledWith(TEAM_ID, USER_ID, MEMBER_ID);
  });

  it('đổi vai trò thành viên', async () => {
    teamService.updateMember.mockResolvedValue({ _id: TEAM_ID });

    const res = await request(app)
      .patch(`/api/v1/teams/${TEAM_ID}/members/${MEMBER_ID}`)
      .set(asUser())
      .send({ role: 'captain' });

    expect(res.status).toBe(200);
    expect(teamService.updateMember).toHaveBeenCalledWith(TEAM_ID, USER_ID, MEMBER_ID, { role: 'captain' });
  });

  it('từ chối vai trò không tồn tại', async () => {
    const res = await request(app)
      .patch(`/api/v1/teams/${TEAM_ID}/members/${MEMBER_ID}`)
      .set(asUser())
      .send({ role: 'coach' });

    expect(res.status).toBe(400);
  });

  it('tạo lại mã mời', async () => {
    teamService.regenerateInviteCode.mockResolvedValue({ inviteCode: 'NEWCODE1' });

    const res = await request(app).post(`/api/v1/teams/${TEAM_ID}/invite-code/regenerate`).set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.inviteCode).toBe('NEWCODE1');
  });
});

describe('chuyển quyền quản lý', () => {
  it('cần chỉ định người nhận', async () => {
    const res = await request(app).post(`/api/v1/teams/${TEAM_ID}/transfer-management`).set(asUser()).send({});

    expect(res.status).toBe(400);
    expect(teamService.transferManagement).not.toHaveBeenCalled();
  });

  it('chuyển quyền cho thành viên khác', async () => {
    teamService.transferManagement.mockResolvedValue({ _id: TEAM_ID });

    const res = await request(app)
      .post(`/api/v1/teams/${TEAM_ID}/transfer-management`)
      .set(asUser())
      .send({ newManagerId: MEMBER_ID });

    expect(res.status).toBe(200);
    expect(teamService.transferManagement).toHaveBeenCalledWith(TEAM_ID, USER_ID, MEMBER_ID);
  });
});

describe('khu quản lý đội', () => {
  it('GET /teams/me/dashboard trả dữ liệu tổng quan', async () => {
    teamService.getManagerDashboard.mockResolvedValue({ teams: [], upcomingMatches: [] });

    const res = await request(app).get('/api/v1/teams/me/dashboard').set(asUser());

    expect(res.status).toBe(200);
    expect(teamService.getManagerDashboard).toHaveBeenCalledWith(USER_ID);
  });

  it('GET /teams/me/my-teams không bị route /:id nuốt mất', async () => {
    teamService.getMyTeams.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/teams/me/my-teams').set(asUser());

    expect(res.status).toBe(200);
    expect(teamService.getTeamById).not.toHaveBeenCalled();
  });
});
