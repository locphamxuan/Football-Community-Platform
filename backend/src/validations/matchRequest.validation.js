const { z } = require('zod');

const createMatchRequestSchema = z.object({
  // Bắt buộc: Zod loại bỏ key lạ, thiếu field này thì service không biết đội nào gửi lời mời
  requesterTeamId: z.string().min(1, 'Requester team ID required'),
  opponentTeamId: z.string().min(1, 'Opponent team ID required'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((d) => new Date(d) >= new Date(new Date().toDateString()), 'Date cannot be in the past'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time HH:mm'),
  fieldSize: z.enum(['5v5', '7v7', '11v11']),
  fieldId: z.string().optional(),
  message: z.string().max(500).optional(),
}).refine((d) => d.startTime < d.endTime, { message: 'End time must be after start time', path: ['endTime'] });

const submitResultSchema = z.object({
  requesterScore: z.number().int().min(0).max(99),
  opponentScore: z.number().int().min(0).max(99),
});

const respondToRequestSchema = z.object({
  accept: z.boolean(),
});

module.exports = { createMatchRequestSchema, submitResultSchema, respondToRequestSchema };
