const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username only letters, numbers, underscores')
    .toLowerCase(),
  fullName: z.string().min(2, 'Full name required').max(100).trim(),
  phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{9}$/, 'Invalid Vietnamese phone number')
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
});

const resendVerificationSchema = z.object({
  email: z.string().email().toLowerCase(),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
};
