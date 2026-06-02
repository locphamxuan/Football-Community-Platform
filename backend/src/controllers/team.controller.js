const teamService = require('../services/team.service');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const getTeams = catchAsync(async (req, res) => {
  const { teams, total, page, limit } = await teamService.getTeams(req.query);
  sendSuccess(res, { teams }, 'Teams retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const getTeamById = catchAsync(async (req, res) => {
  const team = await teamService.getTeamById(req.params.id);
  sendSuccess(res, { team });
});

const getMyTeams = catchAsync(async (req, res) => {
  const teams = await teamService.getMyTeams(req.user.id);
  sendSuccess(res, { teams });
});

const createTeam = catchAsync(async (req, res) => {
  const team = await teamService.createTeam(req.user.id, req.body, req.file);
  sendSuccess(res, { team }, 'Team created successfully', HttpStatus.CREATED);
});

const updateTeam = catchAsync(async (req, res) => {
  const team = await teamService.updateTeam(req.params.id, req.user.id, req.body, req.file);
  sendSuccess(res, { team }, 'Team updated');
});

const deleteTeam = catchAsync(async (req, res) => {
  await teamService.deleteTeam(req.params.id, req.user.id);
  sendSuccess(res, null, 'Team disbanded');
});

const joinTeam = catchAsync(async (req, res) => {
  const team = await teamService.joinTeam(req.params.id, req.user.id, req.body.inviteCode);
  sendSuccess(res, { team }, 'Joined team successfully');
});

const leaveTeam = catchAsync(async (req, res) => {
  await teamService.leaveTeam(req.params.id, req.user.id);
  sendSuccess(res, null, 'Left team successfully');
});

const removeMember = catchAsync(async (req, res) => {
  const team = await teamService.removeMember(req.params.id, req.user.id, req.params.memberId);
  sendSuccess(res, { team }, 'Member removed');
});

const updateMember = catchAsync(async (req, res) => {
  const team = await teamService.updateMember(req.params.id, req.user.id, req.params.memberId, req.body);
  sendSuccess(res, { team }, 'Member updated');
});

const regenerateInviteCode = catchAsync(async (req, res) => {
  const result = await teamService.regenerateInviteCode(req.params.id, req.user.id);
  sendSuccess(res, result, 'Invite code regenerated');
});

module.exports = {
  getTeams, getTeamById, getMyTeams, createTeam, updateTeam, deleteTeam,
  joinTeam, leaveTeam, removeMember, updateMember, regenerateInviteCode,
};
