const Team = require('../../models/Team');
const { getPagination } = require('../../utils/pagination');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');

// ─── getTeams ─────────────────────────────────────────────────────────────────
const getTeams = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { status: 'active', isPublic: true };

  if (query.search) filter.$text = { $search: query.search };
  if (query.city) filter.homeCity = { $regex: query.city, $options: 'i' };
  if (query.skillLevel) filter.skillLevel = query.skillLevel;
  if (query.fieldSize) filter.fieldSize = query.fieldSize;

  const sortMap = {
    elo: { 'stats.eloRating': -1 },
    newest: { createdAt: -1 },
    matches: { 'stats.matchesPlayed': -1 },
  };
  const sort = sortMap[query.sort] || { 'stats.eloRating': -1 };

  const [teams, total] = await Promise.all([
    Team.find(filter)
      .populate('manager', 'username fullName avatar')
      .select('-inviteCode')
      .skip(skip).limit(limit).sort(sort),
    Team.countDocuments(filter),
  ]);
  return { teams, total, page, limit };
};

// ─── getTeamById ──────────────────────────────────────────────────────────────
const getTeamById = async (id) => {
  const team = await Team.findById(id)
    .populate('manager', 'username fullName avatar')
    .populate('members.user', 'username fullName avatar playerProfile.skillLevel playerProfile.positions');
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  return team;
};

// ─── getMyTeams ───────────────────────────────────────────────────────────────
const getMyTeams = async (userId) => {
  return Team.find({
    $or: [{ manager: userId }, { 'members.user': userId }],
    status: { $ne: 'disbanded' },
  })
    .populate('manager', 'username fullName avatar')
    .sort('-createdAt');
};

module.exports = { getTeams, getTeamById, getMyTeams };
