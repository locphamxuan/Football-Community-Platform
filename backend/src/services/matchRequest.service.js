const MatchRequest = require('../models/MatchRequest');
const Team = require('../models/Team');
const { getPagination } = require('../utils/pagination');
const { calculateElo } = require('../utils/elo');
const { formatSlotLabel } = require('../utils/datetime');
const { notify } = require('./notification.service');
const { NotificationType } = require('../constants/notifications');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

const populateOptions = [
  { path: 'requesterTeam', select: 'name logo slug stats.eloRating manager' },
  { path: 'opponentTeam', select: 'name logo slug stats.eloRating manager' },
  { path: 'requestedBy', select: 'username fullName avatar' },
  { path: 'field', select: 'name location images' },
];

// ─── createMatchRequest ───────────────────────────────────────────────────────
const createMatchRequest = async (userId, data) => {
  const requesterTeam = await Team.findOne({
    _id: data.requesterTeamId,
    $or: [{ manager: userId }, { 'members.user': userId }],
    status: 'active',
  });
  if (!requesterTeam) throw new AppError('You are not a member of the requester team', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const opponentTeam = await Team.findById(data.opponentTeamId);
  if (!opponentTeam || opponentTeam.status !== 'active') throw new AppError('Opponent team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  if (requesterTeam._id.toString() === data.opponentTeamId) {
    throw new AppError('Cannot challenge your own team', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }

  // Check không có request pending giữa 2 team này
  const existing = await MatchRequest.findOne({
    $or: [
      { requesterTeam: requesterTeam._id, opponentTeam: data.opponentTeamId, status: 'pending' },
      { requesterTeam: data.opponentTeamId, opponentTeam: requesterTeam._id, status: 'pending' },
    ],
  });
  if (existing) throw new AppError('A pending match request already exists between these teams', HttpStatus.CONFLICT, ErrorCode.CONFLICT);

  const request = await MatchRequest.create({
    requesterTeam: requesterTeam._id,
    opponentTeam: data.opponentTeamId,
    requestedBy: userId,
    field: data.fieldId || undefined,
    date: new Date(data.date),
    startTime: data.startTime,
    endTime: data.endTime,
    fieldSize: data.fieldSize,
    message: data.message || '',
  });

  await notify(opponentTeam.manager, {
    type: NotificationType.MATCH_REQUEST_RECEIVED,
    title: `${requesterTeam.name} muốn thi đấu với đội bạn`,
    body: `${formatSlotLabel(data.date, data.startTime, data.endTime)} · ${data.fieldSize}`,
    link: '/match-requests',
  }, userId);

  return MatchRequest.findById(request._id).populate(populateOptions);
};

// ─── getMatchRequests ─────────────────────────────────────────────────────────
const getMatchRequests = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);

  // Lấy teams của user
  const teams = await Team.find({ $or: [{ manager: userId }, { 'members.user': userId }] }).select('_id');
  const teamIds = teams.map((t) => t._id);

  const filter = {
    $or: [{ requesterTeam: { $in: teamIds } }, { opponentTeam: { $in: teamIds } }],
  };
  if (query.status) filter.status = query.status;
  // Lọc theo một đội cụ thể, nhưng chỉ trong số đội user thực sự thuộc về
  if (query.teamId && teamIds.some((id) => id.toString() === query.teamId)) {
    filter.$or = [{ requesterTeam: query.teamId }, { opponentTeam: query.teamId }];
  }

  const [requests, total] = await Promise.all([
    MatchRequest.find(filter).populate(populateOptions).skip(skip).limit(limit).sort('-createdAt'),
    MatchRequest.countDocuments(filter),
  ]);
  return { requests, total, page, limit };
};

// ─── getMatchRequestById ──────────────────────────────────────────────────────
const getMatchRequestById = async (id) => {
  const request = await MatchRequest.findById(id).populate(populateOptions);
  if (!request) throw new AppError('Match request not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  return request;
};

// ─── respondToRequest ─────────────────────────────────────────────────────────
const respondToRequest = async (requestId, userId, accept) => {
  const request = await MatchRequest.findById(requestId).populate('opponentTeam');
  if (!request) throw new AppError('Match request not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (request.status !== 'pending') throw new AppError('Request is no longer pending', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);

  // Chỉ manager/captain của opponentTeam mới được respond
  const opponentTeam = await Team.findById(request.opponentTeam._id);
  const isMgr = opponentTeam.manager.toString() === userId;
  const isCaptain = opponentTeam.members.some((m) => m.user.toString() === userId && m.role === 'captain');
  if (!isMgr && !isCaptain) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const status = accept ? 'accepted' : 'rejected';
  const updated = await MatchRequest.findByIdAndUpdate(
    requestId,
    { status, respondedAt: new Date() },
    { new: true }
  ).populate(populateOptions);

  await notify(request.requestedBy, {
    type: NotificationType.MATCH_REQUEST_ANSWERED,
    title: accept
      ? `${opponentTeam.name} đã nhận lời thách đấu`
      : `${opponentTeam.name} đã từ chối lời thách đấu`,
    body: formatSlotLabel(request.date, request.startTime, request.endTime),
    link: '/match-requests',
  }, userId);

  return updated;
};

// ─── cancelRequest ────────────────────────────────────────────────────────────
const cancelRequest = async (requestId, userId) => {
  const request = await MatchRequest.findById(requestId);
  if (!request) throw new AppError('Match request not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (request.requestedBy.toString() !== userId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  if (request.status !== 'pending') throw new AppError('Can only cancel pending requests', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);

  return MatchRequest.findByIdAndUpdate(requestId, { status: 'cancelled' }, { new: true }).populate(populateOptions);
};

// ─── submitResult ─────────────────────────────────────────────────────────────
const submitResult = async (requestId, userId, { requesterScore, opponentScore }) => {
  const request = await MatchRequest.findById(requestId);
  if (!request) throw new AppError('Match request not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (request.status !== 'accepted') throw new AppError('Match must be accepted before submitting result', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);

  // Không thể nhập tỉ số cho trận chưa đá — ELO sẽ bị thổi phồng bằng các trận ma
  const kickOff = new Date(`${request.date.toISOString().slice(0, 10)}T${request.startTime}:00Z`);
  if (kickOff.getTime() > Date.now()) {
    throw new AppError('Cannot submit a result before the match has started', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }

  const requesterTeam = await Team.findById(request.requesterTeam);
  const opponentTeam = await Team.findById(request.opponentTeam);

  // Xác định user thuộc team nào để set confirmed flag
  const isFromRequester =
    requesterTeam.manager.toString() === userId ||
    requesterTeam.members.some((m) => m.user.toString() === userId && m.role === 'captain');
  const isFromOpponent =
    opponentTeam.manager.toString() === userId ||
    opponentTeam.members.some((m) => m.user.toString() === userId && m.role === 'captain');

  if (!isFromRequester && !isFromOpponent) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  let winner;
  if (requesterScore > opponentScore) winner = 'requester';
  else if (opponentScore > requesterScore) winner = 'opponent';
  else winner = 'draw';

  const update = {
    'result.requesterScore': requesterScore,
    'result.opponentScore': opponentScore,
    'result.winner': winner,
  };

  if (isFromRequester) update['result.confirmedByRequester'] = true;
  if (isFromOpponent) update['result.confirmedByOpponent'] = true;

  const updated = await MatchRequest.findByIdAndUpdate(requestId, update, { new: true });

  // Nếu cả 2 bên đã confirm → complete + tính ELO
  if (updated.result.confirmedByRequester && updated.result.confirmedByOpponent) {
    const elo = calculateElo(requesterTeam.stats.eloRating, opponentTeam.stats.eloRating, winner);

    await Promise.all([
      Team.findByIdAndUpdate(requesterTeam._id, {
        $inc: {
          'stats.matchesPlayed': 1,
          'stats.wins': winner === 'requester' ? 1 : 0,
          'stats.draws': winner === 'draw' ? 1 : 0,
          'stats.losses': winner === 'opponent' ? 1 : 0,
          'stats.goalsScored': requesterScore,
          'stats.goalsConceded': opponentScore,
        },
        'stats.eloRating': elo.newA,
      }),
      Team.findByIdAndUpdate(opponentTeam._id, {
        $inc: {
          'stats.matchesPlayed': 1,
          'stats.wins': winner === 'opponent' ? 1 : 0,
          'stats.draws': winner === 'draw' ? 1 : 0,
          'stats.losses': winner === 'requester' ? 1 : 0,
          'stats.goalsScored': opponentScore,
          'stats.goalsConceded': requesterScore,
        },
        'stats.eloRating': elo.newB,
      }),
      MatchRequest.findByIdAndUpdate(requestId, {
        status: 'completed',
        completedAt: new Date(),
        'eloChange.requester': elo.changeA,
        'eloChange.opponent': elo.changeB,
      }),
    ]);
  }

  // Trận chỉ được tính Elo khi cả hai bên cùng nhập; bên kia phải biết là đang chờ mình.
  if (!updated.result.confirmedByRequester || !updated.result.confirmedByOpponent) {
    await notify(isFromRequester ? opponentTeam.manager : requesterTeam.manager, {
      type: NotificationType.MATCH_RESULT_SUBMITTED,
      title: 'Đối thủ đã nhập tỉ số',
      body: `${requesterTeam.name} ${requesterScore} – ${opponentScore} ${opponentTeam.name} · xác nhận để tính Elo`,
      link: '/match-requests',
    }, userId);
  }

  return MatchRequest.findById(requestId).populate(populateOptions);
};

module.exports = { createMatchRequest, getMatchRequests, getMatchRequestById, respondToRequest, cancelRequest, submitResult };
