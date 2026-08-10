const { z } = require('zod');

const pricingSlot = z.object({
  morning: z.number().min(0),
  afternoon: z.number().min(0),
  evening: z.number().min(0),
});

const createFieldSchema = z.object({
  name: z.string().min(3).max(100).trim(),
  description: z.string().max(2000).optional(),
  location: z.object({
    address: z.string().min(5, 'Address required'),
    city: z.string().min(1, 'City required'),
    district: z.string().min(1, 'District required'),
    ward: z.string().optional(),
    coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }).optional(),
  }),
  pricing: z.object({
    weekday: pricingSlot,
    weekend: pricingSlot,
  }),
  operatingHours: z.object({
    open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }).refine((h) => h.open < h.close, { message: 'Closing time must be after opening time' }).optional(),
  amenities: z.array(z.string()).optional(),
  rules: z.array(z.string().max(200)).optional(),
  cancellationPolicy: z.string().max(500).optional(),
});

const updateFieldSchema = createFieldSchema.partial().extend({
  // Chủ sân chỉ được bật/tắt nhận đặt sân — 'pending_approval' do hệ thống quản lý
  status: z.enum(['active', 'inactive']).optional(),
  // URL ảnh cần gỡ khỏi sân (ảnh mới vẫn upload qua field `images`)
  removeImages: z.array(z.string().url()).optional(),
});

const createSubFieldSchema = z.object({
  name: z.string().min(1).max(50),
  fieldType: z.enum(['5v5', '7v7', '11v11']),
  surface: z.enum(['natural_grass', 'artificial_grass', 'concrete']).optional(),
  capacity: z.number().int().min(6).max(22),
});

const updateSubFieldSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  fieldType: z.enum(['5v5', '7v7', '11v11']).optional(),
  surface: z.enum(['natural_grass', 'artificial_grass', 'concrete']).optional(),
  capacity: z.number().int().min(6).max(22).optional(),
  status: z.enum(['available', 'maintenance', 'closed']).optional(),
});

const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time HH:mm'),
  fieldType: z.enum(['5v5', '7v7', '11v11']).optional(),
});

const verifyFieldSchema = z.object({
  approve: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

module.exports = {
  createFieldSchema,
  updateFieldSchema,
  createSubFieldSchema,
  updateSubFieldSchema,
  availabilityQuerySchema,
  verifyFieldSchema,
};
