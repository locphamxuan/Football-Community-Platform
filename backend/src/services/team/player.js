const Team = require('../../models/Team');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');

// ─── joinTeam ─────────────────────────────────────────────────────────────────
const joinTeam = async (teamId, userId, inviteCode) => {
  const team = await Team.findById(teamId).select('+inviteCode');
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (team.status !== 'active') throw new AppError('Team is not active', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  if (team.inviteCode !== inviteCode) throw new AppError('Invalid invite code', HttpStatus.BAD_REQUEST, ErrorCode.TOKEN_INVALID);

  const isMember = team.members.some((m) => m.user.toString() === userId);
  if (isMember) throw new AppError('Already a member of this team', HttpStatus.CONFLICT, ErrorCode.CONFLICT);

  const activeCount = team.members.filter((m) => m.status === 'active').length;
  if (activeCount >= team.maxMembers) throw new AppError('Team is full', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);

  team.members.push({ user: userId, role: 'player', joinedAt: new Date() });
  await team.save();
  return team;
};

// ─── leaveTeam ────────────────────────────────────────────────────────────────
const leaveTeam = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (team.manager.toString() === userId) throw new AppError('Manager cannot leave team. Transfer management first.', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);

  const idx = team.members.findIndex((m) => m.user.toString() === userId);
  if (idx === -1) throw new AppError('Not a member of this team', HttpStatus.BAD_REQUEST, ErrorCode.NOT_FOUND);

  team.members.splice(idx, 1);
  await team.save();
};

module.exports = { joinTeam, leaveTeam };
