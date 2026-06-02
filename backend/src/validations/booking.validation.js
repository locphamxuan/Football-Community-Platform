const { z } = require('zod');

const createBookingSchema = z
  .object({
    fieldId: z.string().min(1, 'Field ID required'),
    subFieldId: z.string().min(1, 'Sub-field ID required'),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
      .refine((d) => new Date(d) >= new Date(new Date().toDateString()), 'Booking date cannot be in the past'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time HH:mm'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time HH:mm'),
    teamId: z.string().optional(),
    notes: z.string().max(500).optional(),
    paymentMethod: z.enum(['cash', 'bank_transfer', 'online']).optional(),
  })
  .refine((d) => d.startTime < d.endTime, { message: 'End time must be after start time', path: ['endTime'] });

const cancelBookingSchema = z.object({
  reason: z.string().min(1, 'Cancel reason required').max(500),
});

module.exports = { createBookingSchema, cancelBookingSchema };
