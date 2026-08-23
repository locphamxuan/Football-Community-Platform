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
    promoCode: z.string().trim().max(30).optional(),
  })
  .refine((d) => d.startTime < d.endTime, { message: 'End time must be after start time', path: ['endTime'] });

const cancelBookingSchema = z.object({
  reason: z.string().min(1, 'Cancel reason required').max(500),
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const ownerBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  fieldId: z.string().min(1).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  startDate: z.string().regex(DATE_ONLY, 'startDate must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(DATE_ONLY, 'endDate must be YYYY-MM-DD').optional(),
});

const ownerRevenueQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional(),
});

const teamBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  teamId: z.string().min(1).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  startDate: z.string().regex(DATE_ONLY, 'startDate must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(DATE_ONLY, 'endDate must be YYYY-MM-DD').optional(),
});

module.exports = {
  createBookingSchema, cancelBookingSchema,
  ownerBookingsQuerySchema, ownerRevenueQuerySchema, teamBookingsQuerySchema,
};
