const { z } = require('zod');
const { PLAN_CODES } = require('../constants/plans');
const { AdminAction } = require('../constants/adminAudit');

const paginationQuery = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(100).optional(),
};

const revenueQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional(),
});

const ownersQuerySchema = z.object({
  ...paginationQuery,
  plan: z.enum(PLAN_CODES).optional(),
});

const adminFieldsQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(['active', 'inactive', 'pending_approval']).optional(),
  verified: z.enum(['true', 'false']).optional(),
});

const adminUsersQuerySchema = z.object({
  ...paginationQuery,
  role: z.enum(['user', 'team_manager', 'field_owner', 'admin']).optional(),
  status: z.enum(['active', 'inactive', 'banned']).optional(),
  city: z.string().max(100).optional(),
});

const updateUserSchema = z
  .object({
    status: z.enum(['active', 'inactive', 'banned']).optional(),
    roles: z.array(z.enum(['user', 'team_manager', 'field_owner', 'admin'])).min(1).optional(),
  })
  .refine((d) => d.status !== undefined || d.roles !== undefined, {
    message: 'Provide status or roles to update',
  });

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  adminId: z.string().optional(),
  action: z.enum(Object.values(AdminAction)).optional(),
});

module.exports = {
  revenueQuerySchema,
  ownersQuerySchema,
  adminFieldsQuerySchema,
  adminUsersQuerySchema,
  updateUserSchema,
  auditLogQuerySchema,
};
