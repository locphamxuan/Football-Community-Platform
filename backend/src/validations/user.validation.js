const { z } = require('zod');
const { NOTIFICATION_TYPES } = require('../constants/notifications');

/** Token đẩy do Expo cấp; chuỗi khác dạng này chỉ tốn một vòng gọi mạng để bị từ chối. */
const pushTokenSchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Invalid Expo push token'),
});

/**
 * Ô tìm người để nhắn tin. Bắt buộc có từ khoá: `GET /users/search` không có `q` là một
 * cách vòng vo để tải về danh bạ toàn nền tảng.
 */
const searchUsersSchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(100),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).trim().optional(),
  phone: z.string().regex(/^(0|\+84)[0-9]{9}$/, 'Invalid Vietnamese phone number').optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  location: z.object({
    city: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
  }).optional(),
  playerProfile: z.object({
    positions: z.array(z.enum(['goalkeeper', 'defender', 'midfielder', 'forward'])).max(4).optional(),
    skillLevel: z.enum(['beginner', 'intermediate', 'advanced', 'professional']).optional(),
    bio: z.string().max(500).optional(),
  }).optional(),
});

/**
 * Tuỳ chọn thông báo đi qua endpoint riêng chứ không nhét vào `updateProfileSchema`:
 * cập nhật hồ sơ gửi cả cụm `notifications` sẽ ghi đè danh sách loại đã tắt
 * (xem `updateNotificationPrefs` trong user.service.js).
 *
 * Loại lạ phải bị chặn ở đây — lọt xuống model thì `enum` của Mongoose ném ra
 * ValidationError 500 thay vì 400 kèm tên trường sai.
 */
const updateNotificationsSchema = z.object({
  push: z.boolean().optional(),
  mutedTypes: z.array(z.enum(NOTIFICATION_TYPES)).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

module.exports = {
  updateProfileSchema, updateNotificationsSchema, changePasswordSchema, pushTokenSchema,
  searchUsersSchema,
};
