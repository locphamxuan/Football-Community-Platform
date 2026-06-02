const { z } = require('zod');

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
    preferredFoot: z.enum(['left', 'right', 'both']).optional(),
    preferredFieldSize: z.array(z.enum(['5v5', '7v7', '11v11'])).optional(),
    bio: z.string().max(500).optional(),
  }).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
  }).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const adminUpdateUserSchema = z.object({
  status: z.enum(['active', 'inactive', 'banned']).optional(),
  roles: z.array(z.enum(['user', 'team_manager', 'field_owner', 'admin'])).optional(),
});

module.exports = { updateProfileSchema, changePasswordSchema, adminUpdateUserSchema };
