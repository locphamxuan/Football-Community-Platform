const User = require('../models/User');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { comparePassword, hashPassword } = require('../utils/bcrypt');
const { getPagination } = require('../utils/pagination');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  return user;
};

const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  return user;
};

const updateProfile = async (userId, data) => {
  const user = await User.findByIdAndUpdate(userId, data, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  return user;
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) throw new AppError('Current password is incorrect', HttpStatus.BAD_REQUEST, ErrorCode.INVALID_CREDENTIALS);

  user.password = await hashPassword(newPassword);
  await user.save();
  return { message: 'Password changed successfully' };
};

const updateAvatar = async (userId, file) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  if (user.avatar) {
    const match = user.avatar.match(/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/);
    if (match) await deleteImage(match[1]).catch(() => null);
  }

  const { url } = await uploadImage(file.buffer, file.mimetype, 'avatars', {
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  });

  await User.findByIdAndUpdate(userId, { avatar: url });
  return { avatar: url };
};

const getUsers = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { username: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }
  if (query.role) filter.roles = query.role;
  if (query.status) filter.status = query.status;
  if (query.city) filter['location.city'] = query.city;

  const [users, total] = await Promise.all([
    User.find(filter).skip(skip).limit(limit).sort('-createdAt'),
    User.countDocuments(filter),
  ]);

  return { users, total, page, limit };
};

module.exports = { getMe, getUserById, updateProfile, changePassword, updateAvatar, getUsers };
