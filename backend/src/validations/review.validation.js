const { z } = require('zod');

const createReviewSchema = z.object({
  fieldId: z.string().min(1, 'Field ID required'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  bookingId: z.string().optional(),
});

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

const ownerReplySchema = z.object({
  comment: z.string().min(1).max(500),
});

module.exports = { createReviewSchema, updateReviewSchema, ownerReplySchema };
