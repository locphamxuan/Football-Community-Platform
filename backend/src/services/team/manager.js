const slugify = require('slugify');
const Team = require('../../models/Team');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const MatchRequest = require('../../models/MatchRequest');
const Role = require('../../constants/roles');
const { uploadImage, deleteImage } = require('../../config/cloudinary');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');
const { generateInviteCode, generateUniqueSlug } = require('./helpers');

// ─── createTeam ───────────────────────────────────────────────────────────────
const createTeam = async (managerId, data, file) => {
  const slug = await generateUniqueSlug(slugify(data.name, { lower: true, strict: true }));
  const inviteCode = generateInviteCode();

  let logo = '';
  if (file) {
    const { url } = await uploadImage(file.buffer, file.mimetype, 'teams');
    logo = url;
  }

  const team = await Team.create({
    ...data,
    slug,
    inviteCode,
    logo,
    manager: managerId,
    members: [{ user: managerId, role: 'manager', joinedAt: new Date() }],
  });

  // Tạo đội là hành động biến một user thành quản lý đội — role phải phản ánh đúng để mở khu quản lý
  await User.findByIdAndUpdate(managerId, { $addToSet: { roles: Role.TEAM_MANAGER } });

  return team;
};

// ─── updateTeam ───────────────────────────────────────────────────────────────
const updateTeam = async (teamId, managerId, data, file) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (team.manager.toString() !== managerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  if (file) {
    if (team.logo) {
      const m = team.logo.match(/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/);
      if (m) await deleteImage(m[1]).catch(() => null);
    }
    const { url } = await uploadImage(file.buffer, file.mimetype, 'teams');
    data.logo = url;
  }

  if (data.name && data.name !== team.name) {
    data.slug = await generateUniqueSlug(slugify(data.name, { lower: true, strict: true }), teamId);
  }

  return Team.findByIdAndUpdate(teamId, data, { new: true })
    .populate('manager', 'username fullName avatar');
};

// ─── deleteTeam ───────────────────────────────────────────────────────────────
const deleteTeam = async (teamId, managerId) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (team.manager.toString() !== managerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  await Team.findByIdAndUpdate(teamId, { status: 'disbanded' });
};

// ─── removeMember ─────────────────────────────────────────────────────────────
const removeMember = async (teamId, managerId, memberId) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (team.manager.toString() !== managerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  if (memberId === managerId) throw new AppError('Cannot remove yourself as manager', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);

  const idx = team.members.findIndex((m) => m.user.toString() === memberId);
  if (idx === -1) throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  team.members.splice(idx, 1);
  await team.save();
  return team;
};

// ─── updateMember ─────────────────────────────────────────────────────────────
const updateMember = async (teamId, managerId, memberId, data) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (team.manager.toString() !== managerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const member = team.members.find((m) => m.user.toString() === memberId);
  if (!member) throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  Object.assign(member, data);
  await team.save();
  return team;
};

// ─── regenerateInviteCode ─────────────────────────────────────────────────────
const regenerateInviteCode = async (teamId, managerId) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (team.manager.toString() !== managerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const newCode = generateInviteCode();
  await Team.findByIdAndUpdate(teamId, { inviteCode: newCode });
  return { inviteCode: newCode };
};

// ─── transferManagement ───────────────────────────────────────────────────────
/** Chuyển quyền quản lý đội. Không có bước này thì manager không bao giờ rời đội được. */
const transferManagement = async (teamId, managerId, newManagerId) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (team.manager.toString() !== managerId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  if (newManagerId === managerId) {
    throw new AppError('You are already the manager', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }

  const target = team.members.find((m) => m.user.toString() === newManagerId);
  if (!target) throw new AppError('New manager must be a member of the team', HttpStatus.BAD_REQUEST, ErrorCode.NOT_FOUND);
  if (target.status !== 'active') {
    throw new AppError('New manager must be an active member', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }

  const previous = team.members.find((m) => m.user.toString() === managerId);
  if (previous) previous.role = 'player';
  target.role = 'manager';
  team.manager = target.user;
  await team.save();

  await User.findByIdAndUpdate(newManagerId, { $addToSet: { roles: Role.TEAM_MANAGER } });
  return team;
};

// ─── getManagerDashboard ──────────────────────────────────────────────────────
/**
 * Tổng quan cho người quản lý đội bóng: đội mình dẫn dắt, việc đang chờ xử lý và lịch sắp tới.
 * Chỉ tính các đội user là manager — thành viên thường không có việc gì để "quản lý".
 */
const getManagerDashboard = async (userId) => {
  const teams = await Team.find({ manager: userId, status: { $ne: 'disbanded' } })
    .populate('members.user', 'username fullName avatar')
    .sort('-createdAt');

  const empty = {
    teams: [],
    totals: {
      totalTeams: 0, totalMembers: 0, matchesPlayed: 0,
      wins: 0, draws: 0, losses: 0, winRate: 0, averageElo: 0,
    },
    pendingIncoming: 0,
    pendingOutgoing: 0,
    awaitingResult: 0,
    upcomingMatches: [],
    upcomingBookings: [],
  };
  if (teams.length === 0) return empty;

  const teamIds = teams.map((t) => t._id);
  const today = new Date(new Date().toISOString().slice(0, 10));

  const [pendingIncoming, pendingOutgoing, awaitingResult, upcomingMatches, upcomingBookings] = await Promise.all([
    MatchRequest.countDocuments({ opponentTeam: { $in: teamIds }, status: 'pending' }),
    MatchRequest.countDocuments({ requesterTeam: { $in: teamIds }, status: 'pending' }),
    MatchRequest.countDocuments({
      $or: [{ requesterTeam: { $in: teamIds } }, { opponentTeam: { $in: teamIds } }],
      status: 'accepted',
      date: { $lt: today },
    }),
    MatchRequest.find({
      $or: [{ requesterTeam: { $in: teamIds } }, { opponentTeam: { $in: teamIds } }],
      status: 'accepted',
      date: { $gte: today },
    })
      .populate('requesterTeam', 'name logo')
      .populate('opponentTeam', 'name logo')
      .populate('field', 'name location')
      .sort('date')
      .limit(5),
    Booking.find({
      team: { $in: teamIds },
      status: { $in: ['pending', 'confirmed'] },
      date: { $gte: today },
    })
      .populate('field', 'name location')
      .populate('team', 'name logo')
      .sort('date')
      .limit(5),
  ]);

  const totals = teams.reduce(
    (acc, t) => ({
      totalTeams: acc.totalTeams + 1,
      totalMembers: acc.totalMembers + t.members.filter((m) => m.status === 'active').length,
      matchesPlayed: acc.matchesPlayed + t.stats.matchesPlayed,
      wins: acc.wins + t.stats.wins,
      draws: acc.draws + t.stats.draws,
      losses: acc.losses + t.stats.losses,
      eloSum: acc.eloSum + t.stats.eloRating,
    }),
    { totalTeams: 0, totalMembers: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, eloSum: 0 }
  );

  return {
    teams,
    totals: {
      totalTeams: totals.totalTeams,
      totalMembers: totals.totalMembers,
      matchesPlayed: totals.matchesPlayed,
      wins: totals.wins,
      draws: totals.draws,
      losses: totals.losses,
      winRate: totals.matchesPlayed > 0 ? Math.round((totals.wins / totals.matchesPlayed) * 100) : 0,
      averageElo: Math.round(totals.eloSum / totals.totalTeams),
    },
    pendingIncoming,
    pendingOutgoing,
    awaitingResult,
    upcomingMatches,
    upcomingBookings,
  };
};

module.exports = {
  createTeam, updateTeam, deleteTeam,
  removeMember, updateMember,
  regenerateInviteCode, transferManagement, getManagerDashboard,
};
