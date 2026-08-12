// Thông báo có test riêng ở notification.service.test.js; ở đây chỉ cần nó không chạm Mongo.
jest.mock('../../src/services/notification.service');
jest.mock('../../src/models/MatchRequest', () => ({
  findById: jest.fn(), findOne: jest.fn(), find: jest.fn(),
  findByIdAndUpdate: jest.fn(), create: jest.fn(), countDocuments: jest.fn(),
}));
jest.mock('../../src/models/Team', () => ({
  findById: jest.fn(), findOne: jest.fn(), find: jest.fn(), findByIdAndUpdate: jest.fn(),
}));

const MatchRequest = require('../../src/models/MatchRequest');
const Team = require('../../src/models/Team');
const { notify } = require('../../src/services/notification.service');
const matchRequestService = require('../../src/services/matchRequest.service');

const MANAGER_A = '000000000000000000000001';
const MANAGER_B = '000000000000000000000002';
const CAPTAIN_B = '000000000000000000000003';
const OUTSIDER = '000000000000000000000004';
const TEAM_A = '000000000000000000000010';
const TEAM_B = '000000000000000000000011';
const REQUEST_ID = '000000000000000000000020';

const hoursFromNow = (h) => new Date(Date.now() + h * 3600000);

const fakeTeam = (id, managerId, members = []) => ({
  _id: id,
  manager: { toString: () => managerId },
  members,
  status: 'active',
  stats: { eloRating: 1200 },
});

const member = (userId, role) => ({ user: { toString: () => userId }, role });

/** Lời mời đã được chấp nhận, giờ đá đã trôi qua. */
const acceptedRequest = (overrides = {}) => ({
  _id: REQUEST_ID,
  requesterTeam: TEAM_A,
  opponentTeam: TEAM_B,
  requestedBy: { toString: () => MANAGER_A },
  status: 'accepted',
  date: hoursFromNow(-3),
  startTime: hoursFromNow(-2).toISOString().slice(11, 16),
  ...overrides,
});

const mockPopulated = (value) => ({ populate: () => Promise.resolve(value) });

beforeEach(() => {
  Team.findByIdAndUpdate.mockResolvedValue({});
  MatchRequest.findByIdAndUpdate.mockResolvedValue({});
});

describe('respondToRequest', () => {
  // date/startTime/endTime là required trong schema — thiếu chúng thì fixture không
  // giống bất kỳ document thật nào và test bỏ lọt lỗi ở nhánh dựng thông báo.
  const pending = {
    _id: REQUEST_ID,
    status: 'pending',
    opponentTeam: { _id: TEAM_B },
    requestedBy: { toString: () => MANAGER_A },
    date: hoursFromNow(48),
    startTime: '18:00',
    endTime: '20:00',
  };

  it('quản lý đội được mời chấp nhận được', async () => {
    MatchRequest.findById.mockReturnValue(mockPopulated(pending));
    Team.findById.mockResolvedValue(fakeTeam(TEAM_B, MANAGER_B));
    MatchRequest.findByIdAndUpdate.mockReturnValue(mockPopulated({ status: 'accepted' }));

    const result = await matchRequestService.respondToRequest(REQUEST_ID, MANAGER_B, true);

    expect(result.status).toBe('accepted');
    expect(MatchRequest.findByIdAndUpdate).toHaveBeenCalledWith(
      REQUEST_ID, expect.objectContaining({ status: 'accepted' }), { new: true }
    );
  });

  it('đội trưởng cũng được phản hồi', async () => {
    MatchRequest.findById.mockReturnValue(mockPopulated(pending));
    Team.findById.mockResolvedValue(fakeTeam(TEAM_B, MANAGER_B, [member(CAPTAIN_B, 'captain')]));
    MatchRequest.findByIdAndUpdate.mockReturnValue(mockPopulated({ status: 'rejected' }));

    await expect(matchRequestService.respondToRequest(REQUEST_ID, CAPTAIN_B, false)).resolves.toBeDefined();
  });

  it('thành viên thường không phản hồi thay đội được', async () => {
    MatchRequest.findById.mockReturnValue(mockPopulated(pending));
    Team.findById.mockResolvedValue(fakeTeam(TEAM_B, MANAGER_B, [member(OUTSIDER, 'player')]));

    await expect(matchRequestService.respondToRequest(REQUEST_ID, OUTSIDER, true))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('lời mời đã trả lời rồi thì không trả lời lại', async () => {
    MatchRequest.findById.mockReturnValue(mockPopulated({ ...pending, status: 'accepted' }));

    await expect(matchRequestService.respondToRequest(REQUEST_ID, MANAGER_B, true))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('cancelRequest', () => {
  it('chỉ người gửi mới huỷ được', async () => {
    MatchRequest.findById.mockResolvedValue({ requestedBy: { toString: () => MANAGER_A }, status: 'pending' });

    await expect(matchRequestService.cancelRequest(REQUEST_ID, MANAGER_B))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('không huỷ lời mời đã được chấp nhận', async () => {
    MatchRequest.findById.mockResolvedValue({ requestedBy: { toString: () => MANAGER_A }, status: 'accepted' });

    await expect(matchRequestService.cancelRequest(REQUEST_ID, MANAGER_A))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('submitResult', () => {
  const setup = ({ request = acceptedRequest(), confirmed = {} } = {}) => {
    MatchRequest.findById
      .mockResolvedValueOnce(request)
      .mockReturnValueOnce(mockPopulated({ _id: REQUEST_ID }));
    Team.findById
      .mockResolvedValueOnce(fakeTeam(TEAM_A, MANAGER_A))
      .mockResolvedValueOnce(fakeTeam(TEAM_B, MANAGER_B));
    MatchRequest.findByIdAndUpdate.mockResolvedValueOnce({
      result: { confirmedByRequester: false, confirmedByOpponent: false, ...confirmed },
    });
  };

  it('không nhập được tỉ số cho trận chưa đá — Elo sẽ bị thổi phồng', async () => {
    MatchRequest.findById.mockResolvedValue(acceptedRequest({
      date: hoursFromNow(48),
      startTime: hoursFromNow(48).toISOString().slice(11, 16),
    }));

    await expect(matchRequestService.submitResult(REQUEST_ID, MANAGER_A, { requesterScore: 1, opponentScore: 0 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('trận chưa được chấp nhận thì không có kết quả', async () => {
    MatchRequest.findById.mockResolvedValue(acceptedRequest({ status: 'pending' }));

    await expect(matchRequestService.submitResult(REQUEST_ID, MANAGER_A, { requesterScore: 1, opponentScore: 0 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('người ngoài cuộc không nhập tỉ số được', async () => {
    MatchRequest.findById.mockResolvedValue(acceptedRequest());
    Team.findById
      .mockResolvedValueOnce(fakeTeam(TEAM_A, MANAGER_A))
      .mockResolvedValueOnce(fakeTeam(TEAM_B, MANAGER_B));

    await expect(matchRequestService.submitResult(REQUEST_ID, OUTSIDER, { requesterScore: 1, opponentScore: 0 }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('một bên nhập thì mới ghi nhận xác nhận, chưa tính Elo', async () => {
    setup();

    await matchRequestService.submitResult(REQUEST_ID, MANAGER_A, { requesterScore: 2, opponentScore: 1 });

    expect(MatchRequest.findByIdAndUpdate).toHaveBeenCalledWith(
      REQUEST_ID,
      expect.objectContaining({ 'result.winner': 'requester', 'result.confirmedByRequester': true }),
      { new: true }
    );
    expect(Team.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('cả hai bên xác nhận thì cộng Elo và đóng trận', async () => {
    setup({ confirmed: { confirmedByRequester: true, confirmedByOpponent: true } });

    await matchRequestService.submitResult(REQUEST_ID, MANAGER_B, { requesterScore: 3, opponentScore: 1 });

    // Hai đội cùng 1200 điểm: bên thắng +16, bên thua -16
    expect(Team.findByIdAndUpdate).toHaveBeenCalledWith(TEAM_A, expect.objectContaining({ 'stats.eloRating': 1216 }));
    expect(Team.findByIdAndUpdate).toHaveBeenCalledWith(TEAM_B, expect.objectContaining({ 'stats.eloRating': 1184 }));
    expect(MatchRequest.findByIdAndUpdate).toHaveBeenLastCalledWith(
      REQUEST_ID,
      expect.objectContaining({ status: 'completed', 'eloChange.requester': 16, 'eloChange.opponent': -16 })
    );
  });

  it('hoà thì không đội nào đổi điểm', async () => {
    setup({ confirmed: { confirmedByRequester: true, confirmedByOpponent: true } });

    await matchRequestService.submitResult(REQUEST_ID, MANAGER_A, { requesterScore: 2, opponentScore: 2 });

    expect(Team.findByIdAndUpdate).toHaveBeenCalledWith(TEAM_A, expect.objectContaining({ 'stats.eloRating': 1200 }));
    expect(Team.findByIdAndUpdate).toHaveBeenCalledWith(TEAM_B, expect.objectContaining({ 'stats.eloRating': 1200 }));
  });
});

describe('thông báo đi kèm lời mời thi đấu', () => {
  const notifyCall = () => {
    const [recipient, payload, actorId] = notify.mock.calls[0];
    return { recipient: recipient.toString(), payload, actorId };
  };

  it('trả lời lời mời thì người gửi được báo', async () => {
    MatchRequest.findById.mockReturnValue(mockPopulated({
      _id: REQUEST_ID,
      status: 'pending',
      opponentTeam: { _id: TEAM_B },
      requestedBy: { toString: () => MANAGER_A },
      date: hoursFromNow(48),
      startTime: '18:00',
      endTime: '20:00',
    }));
    Team.findById.mockResolvedValue(fakeTeam(TEAM_B, MANAGER_B));
    MatchRequest.findByIdAndUpdate.mockReturnValue(mockPopulated({ status: 'accepted' }));

    await matchRequestService.respondToRequest(REQUEST_ID, MANAGER_B, true);

    const { recipient, payload, actorId } = notifyCall();
    expect(recipient).toBe(MANAGER_A);
    expect(payload).toMatchObject({ type: 'match_request_answered', link: '/match-requests' });
    expect(actorId).toBe(MANAGER_B);
  });

  it('một bên nhập tỉ số thì bên kia được nhắc xác nhận', async () => {
    MatchRequest.findById
      .mockResolvedValueOnce(acceptedRequest())
      .mockReturnValueOnce(mockPopulated({ _id: REQUEST_ID }));
    Team.findById
      .mockResolvedValueOnce(fakeTeam(TEAM_A, MANAGER_A))
      .mockResolvedValueOnce(fakeTeam(TEAM_B, MANAGER_B));
    MatchRequest.findByIdAndUpdate.mockResolvedValueOnce({
      result: { confirmedByRequester: true, confirmedByOpponent: false },
    });

    await matchRequestService.submitResult(REQUEST_ID, MANAGER_A, { requesterScore: 2, opponentScore: 1 });

    const { recipient, payload } = notifyCall();
    expect(recipient).toBe(MANAGER_B);
    expect(payload.type).toBe('match_result_submitted');
  });

  it('cả hai bên đã xác nhận thì thôi nhắc — trận đã đóng', async () => {
    MatchRequest.findById
      .mockResolvedValueOnce(acceptedRequest())
      .mockReturnValueOnce(mockPopulated({ _id: REQUEST_ID }));
    Team.findById
      .mockResolvedValueOnce(fakeTeam(TEAM_A, MANAGER_A))
      .mockResolvedValueOnce(fakeTeam(TEAM_B, MANAGER_B));
    MatchRequest.findByIdAndUpdate.mockResolvedValueOnce({
      result: { confirmedByRequester: true, confirmedByOpponent: true },
    });

    await matchRequestService.submitResult(REQUEST_ID, MANAGER_B, { requesterScore: 2, opponentScore: 1 });

    expect(notify).not.toHaveBeenCalled();
  });
});
