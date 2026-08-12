const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');

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

const addPushToken = catchAsync(async (req, res) => {
  const result = await userService.addPushToken(req.user.id, req.body.token);
  sendSuccess(res, result, 'Push token registered');
});

const removePushToken = catchAsync(async (req, res) => {
  const result = await userService.removePushToken(req.user.id, req.body.token);
  sendSuccess(res, result, 'Push token removed');
});

module.exports = {
  getMe, getUserById, updateProfile, changePassword, updateAvatar,
  addPushToken, removePushToken,
};
