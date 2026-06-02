const userService = require('../services/user.service');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const getMe = catchAsync(async (req, res) => {
  const user = await userService.getMe(req.user.id);
  sendSuccess(res, { user });
});

const getUserById = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  sendSuccess(res, { user });
});

const updateProfile = catchAsync(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  sendSuccess(res, { user }, 'Profile updated successfully');
});

const changePassword = catchAsync(async (req, res) => {
  const result = await userService.changePassword(req.user.id, req.body);
  sendSuccess(res, result, result.message);
});

const updateAvatar = catchAsync(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Image file is required' });
  const result = await userService.updateAvatar(req.user.id, req.file);
  sendSuccess(res, result, 'Avatar updated successfully');
});

const getUsers = catchAsync(async (req, res) => {
  const { users, total, page, limit } = await userService.getUsers(req.query);
  sendSuccess(res, { users }, 'Users retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const user = await userService.updateUserStatus(req.params.id, req.body.status);
  sendSuccess(res, { user }, 'User status updated');
});

module.exports = { getMe, getUserById, updateProfile, changePassword, updateAvatar, getUsers, updateUserStatus };
