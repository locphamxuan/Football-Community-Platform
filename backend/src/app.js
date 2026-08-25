const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');

const env = require('./config/env');
const { getRedisStatus } = require('./config/redis');
const { globalLimiter, writeLimiter, webhookLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

// ── Routes ────────────────────────────────────────────────────────────────────
const apiRoutes = require('./routes');
const paymentWebhookRoutes = require('./routes/paymentWebhook.routes');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // X-Client cho app di động tự khai mình là mobile (xem auth.controller)
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
}));

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // chặn NoSQL injection

// ── Logging ───────────────────────────────────────────────────────────────────
// Trong test, log mỗi request chỉ làm nhiễu kết quả jest
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Webhook cổng thanh toán ───────────────────────────────────────────────────
// Nằm ngoài /api: VNPay gọi vào không mang JWT nên `authenticate` không áp dụng, và endpoint
// này không nên bị `globalLimiter`/`writeLimiter` (dựng cho người dùng đã đăng nhập) áp vào —
// có trần riêng (`webhookLimiter`). Chữ ký VNPay là hàng rào chính, không phải JWT hay CSRF.
app.use('/webhooks/payments', webhookLimiter, paymentWebhookRoutes);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Trần chung cho mọi request, cộng thêm trần chặt hơn cho các request ghi.
app.use('/api', globalLimiter, writeLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
// Không nằm dưới /api nên không bị rate limit — probe của Docker gọi liên tục.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: env.NODE_ENV,
    redis: getRedisStatus(),
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', apiRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
