# ── Production image ───────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY src ./src

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# src/server.js listen theo biến PORT, nên EXPOSE và healthcheck phải đi theo nó,
# nếu không container bị báo unhealthy khi PORT khác 5000.
ENV PORT=5000
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT}/health" || exit 1

CMD ["node", "src/server.js"]
