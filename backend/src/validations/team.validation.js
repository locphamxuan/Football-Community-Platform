const { z } = require('zod');

const createTeamSchema = z.object({
  name: z.string().min(3, 'Team name min 3 chars').max(100).trim(),
  description: z.string().max(1000).optional(),
  homeCity: z.string().max(100).optional(),
  homeDistrict: z.string().max(100).optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced', 'professional']).optional(),
  fieldSize: z.enum(['5v5', '7v7', '11v11']).optional(),
  maxMembers: z.number().int().min(5).max(30).optional(),
  isPublic: z.boolean().optional(),
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

module.exports = { createTeamSchema, updateTeamSchema, updateMemberSchema, joinTeamSchema };
