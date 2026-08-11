jest.mock('../../src/models/Team', () => ({
  findById: jest.fn(), findOne: jest.fn(), find: jest.fn(), exists: jest.fn(),
  findByIdAndUpdate: jest.fn(), create: jest.fn(), countDocuments: jest.fn(),
}));
jest.mock('../../src/models/User', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../../src/config/cloudinary', () => ({
  uploadImage: jest.fn().mockResolvedValue({ url: 'https://cdn/logo.png' }),
  deleteImage: jest.fn().mockResolvedValue(undefined),
}));

const Team = require('../../src/models/Team');
const User = require('../../src/models/User');
const teamService = require('../../src/services/team.service');
const Role = require('../../src/constants/roles');

const MANAGER_ID = '000000000000000000000001';
const MEMBER_ID = '000000000000000000000002';
const OUTSIDER_ID = '000000000000000000000003';
const TEAM_ID = '000000000000000000000010';

const member = (userId, role = 'player', status = 'active') => ({
  user: { toString: () => userId },
  role,
  status,
});

const fakeTeam = (overrides = {}) => ({
  _id: TEAM_ID,
  name: 'Probe FC',
  status: 'active',
  manager: { toString: () => MANAGER_ID },
  maxMembers: 20,
  inviteCode: 'PROBE123',
  members: [member(MANAGER_ID, 'manager')],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

/** Team.findById(...).select('+inviteCode') dùng ở joinTeam. */
const foundWithSelect = (team) => Team.findById.mockReturnValue({ select: () => Promise.resolve(team) });

beforeEach(() => {
  Team.exists.mockResolvedValue(null);
  Team.findByIdAndUpdate.mockResolvedValue({});
  User.findByIdAndUpdate.mockResolvedValue({});
});

describe('createTeam', () => {
  it('người tạo trở thành quản lý và được cấp role team_manager', async () => {
    Team.create.mockImplementation((data) => Promise.resolve({ _id: TEAM_ID, ...data }));

    const team = await teamService.createTeam(MANAGER_ID, { name: 'Probe FC' });

    expect(team.manager).toBe(MANAGER_ID);
    expect(team.members[0]).toMatchObject({ user: MANAGER_ID, role: 'manager' });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      MANAGER_ID, { $addToSet: { roles: Role.TEAM_MANAGER } }
    );
  });

  it('sinh slug và mã mời tự động', async () => {
    Team.create.mockImplementation((data) => Promise.resolve(data));

    const team = await teamService.createTeam(MANAGER_ID, { name: 'Đội Bóng Số 1' });

    expect(team.slug).toMatch(/^[a-z0-9-]+$/);
    expect(team.inviteCode).toEqual(expect.any(String));
  });
});

describe('joinTeam', () => {
  it('mã mời đúng thì được vào đội với vai trò player', async () => {
    const team = fakeTeam();
    foundWithSelect(team);

    const result = await teamService.joinTeam(TEAM_ID, MEMBER_ID, 'PROBE123');

    expect(result.members).toHaveLength(2);
    expect(result.members[1]).toMatchObject({ user: MEMBER_ID, role: 'player' });
    expect(team.save).toHaveBeenCalled();
  });

  it('mã mời sai bị từ chối', async () => {
    foundWithSelect(fakeTeam());

    await expect(teamService.joinTeam(TEAM_ID, MEMBER_ID, 'SAI-MA'))
      .rejects.toMatchObject({ statusCode: 400, code: 'TOKEN_INVALID' });
  });

  it('đội đã giải thể thì không vào được', async () => {
    foundWithSelect(fakeTeam({ status: 'disbanded' }));

    await expect(teamService.joinTeam(TEAM_ID, MEMBER_ID, 'PROBE123'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('đã là thành viên thì không vào lại', async () => {
    foundWithSelect(fakeTeam({ members: [member(MANAGER_ID, 'manager'), member(MEMBER_ID)] }));

    await expect(teamService.joinTeam(TEAM_ID, MEMBER_ID, 'PROBE123'))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('đội đầy thì dừng lại', async () => {
    foundWithSelect(fakeTeam({ maxMembers: 1 }));

    await expect(teamService.joinTeam(TEAM_ID, MEMBER_ID, 'PROBE123'))
      .rejects.toMatchObject({ statusCode: 400, message: 'Team is full' });
  });
});

describe('leaveTeam', () => {
  it('thành viên rời được đội', async () => {
    const team = fakeTeam({ members: [member(MANAGER_ID, 'manager'), member(MEMBER_ID)] });
    Team.findById.mockResolvedValue(team);

    await teamService.leaveTeam(TEAM_ID, MEMBER_ID);

    expect(team.members).toHaveLength(1);
  });

  it('quản lý không rời đội khi chưa chuyển quyền — đội sẽ mất người phụ trách', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    await expect(teamService.leaveTeam(TEAM_ID, MANAGER_ID))
      .rejects.toMatchObject({ message: expect.stringMatching(/transfer management/i) });
  });

  it('người ngoài đội không rời được', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    await expect(teamService.leaveTeam(TEAM_ID, OUTSIDER_ID)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('removeMember', () => {
  it('quản lý gỡ được thành viên', async () => {
    const team = fakeTeam({ members: [member(MANAGER_ID, 'manager'), member(MEMBER_ID)] });
    Team.findById.mockResolvedValue(team);

    const result = await teamService.removeMember(TEAM_ID, MANAGER_ID, MEMBER_ID);

    expect(result.members).toHaveLength(1);
  });

  it('không tự gỡ chính mình', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    await expect(teamService.removeMember(TEAM_ID, MANAGER_ID, MANAGER_ID))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('người không phải quản lý thì không gỡ ai được', async () => {
    Team.findById.mockResolvedValue(fakeTeam({ members: [member(MANAGER_ID, 'manager'), member(MEMBER_ID)] }));

    await expect(teamService.removeMember(TEAM_ID, MEMBER_ID, MANAGER_ID))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('thành viên không tồn tại trả 404', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    await expect(teamService.removeMember(TEAM_ID, MANAGER_ID, OUTSIDER_ID))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('transferManagement', () => {
  it('chuyển quyền: người nhận thành manager, người cũ thành player', async () => {
    const team = fakeTeam({ members: [member(MANAGER_ID, 'manager'), member(MEMBER_ID)] });
    Team.findById.mockResolvedValue(team);

    const result = await teamService.transferManagement(TEAM_ID, MANAGER_ID, MEMBER_ID);

    expect(result.members[0].role).toBe('player');
    expect(result.members[1].role).toBe('manager');
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      MEMBER_ID, { $addToSet: { roles: Role.TEAM_MANAGER } }
    );
  });

  it('người nhận phải là thành viên của đội', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    await expect(teamService.transferManagement(TEAM_ID, MANAGER_ID, OUTSIDER_ID))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('người nhận phải đang hoạt động', async () => {
    Team.findById.mockResolvedValue(fakeTeam({
      members: [member(MANAGER_ID, 'manager'), member(MEMBER_ID, 'player', 'inactive')],
    }));

    await expect(teamService.transferManagement(TEAM_ID, MANAGER_ID, MEMBER_ID))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('chuyển cho chính mình là vô nghĩa', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    await expect(teamService.transferManagement(TEAM_ID, MANAGER_ID, MANAGER_ID))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('chỉ quản lý hiện tại được chuyển quyền', async () => {
    Team.findById.mockResolvedValue(fakeTeam({ members: [member(MANAGER_ID, 'manager'), member(MEMBER_ID)] }));

    await expect(teamService.transferManagement(TEAM_ID, MEMBER_ID, OUTSIDER_ID))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('regenerateInviteCode', () => {
  it('quản lý đổi được mã mời', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    const { inviteCode } = await teamService.regenerateInviteCode(TEAM_ID, MANAGER_ID);

    expect(inviteCode).not.toBe('PROBE123');
    expect(Team.findByIdAndUpdate).toHaveBeenCalledWith(TEAM_ID, { inviteCode });
  });

  it('thành viên thường không đổi được', async () => {
    Team.findById.mockResolvedValue(fakeTeam({ members: [member(MANAGER_ID, 'manager'), member(MEMBER_ID)] }));

    await expect(teamService.regenerateInviteCode(TEAM_ID, MEMBER_ID))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('deleteTeam', () => {
  it('giải thể chứ không xoá hẳn — lịch sử trận đấu phải còn', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    await teamService.deleteTeam(TEAM_ID, MANAGER_ID);

    expect(Team.findByIdAndUpdate).toHaveBeenCalledWith(TEAM_ID, { status: 'disbanded' });
  });

  it('chỉ quản lý mới giải thể được', async () => {
    Team.findById.mockResolvedValue(fakeTeam());

    await expect(teamService.deleteTeam(TEAM_ID, MEMBER_ID)).rejects.toMatchObject({ statusCode: 403 });
  });
});
