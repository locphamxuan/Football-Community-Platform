const { randomBytes } = require('crypto');
const slugify = require('slugify');
const Team = require('../models/Team');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { getPagination } = require('../utils/pagination');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

const generateInviteCode = () => randomBytes(4).toString('hex').toUpperCase();

const generateUniqueSlug = async (base, excludeId) => {
  let slug = base;
  let counter = 0;
  for (;;) {
    const q = excludeId ? { slug, _id: { $ne: excludeId } } : { slug };
    const exists = await Team.exists(q);
    if (!exists) return slug;
    slug = `${base}-${++counter}`;
  }
};

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

// ─── createTeam ───────────────────────────────────────────────────────────────
const createTeam = async (managerId, data, file) => {
  const slug = await generateUniqueSlug(slugify(data.name, { lower: true, strict: true }));
  const inviteCode = generateInviteCode();

  let logo = '';
  if (file) {
    const { url } = await uploadImage(file.buffer, file.mimetype, 'teams');
    logo = url;
  }

  return Team.create({
    ...data,
    slug,
    inviteCode,
    logo,
    manager: managerId,
    members: [{ user: managerId, role: 'manager', joinedAt: new Date() }],
  });
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

module.exports = {
  getTeams, getTeamById, getMyTeams,
  createTeam, updateTeam, deleteTeam,
  joinTeam, leaveTeam, removeMember, updateMember,
  regenerateInviteCode,
};
