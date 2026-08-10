const { z } = require('zod');

/**
 * Team được gửi qua multipart/form-data (có logo), nên multer trả về mọi field dạng chuỗi.
 * Phải ép kiểu ở tầng validation, nếu không `z.number()`/`z.boolean()` luôn fail.
 */
const booleanish = z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true');

const createTeamSchema = z.object({
  name: z.string().min(3, 'Team name min 3 chars').max(100).trim(),
  description: z.string().max(1000).optional(),
  homeCity: z.string().max(100).optional(),
  homeDistrict: z.string().max(100).optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced', 'professional']).optional(),
  fieldSize: z.enum(['5v5', '7v7', '11v11']).optional(),
  maxMembers: z.coerce.number().int().min(5).max(30).optional(),
  isPublic: booleanish.optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

const updateTeamSchema = createTeamSchema.partial();

const updateMemberSchema = z.object({
  role: z.enum(['captain', 'player']).optional(),
  position: z.string().max(50).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const joinTeamSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code required'),
});

const transferManagementSchema = z.object({
  newManagerId: z.string().min(1, 'New manager is required'),
});

module.exports = {
  createTeamSchema, updateTeamSchema, updateMemberSchema,
  joinTeamSchema, transferManagementSchema,
};
