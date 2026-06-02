---
name: feedback-backend-js
description: User muốn backend dùng plain JavaScript không TypeScript
metadata:
  type: feedback
---

Không dùng TypeScript cho backend của dự án này.
**Why:** User yêu cầu "nodejs expressjs mongo thông thường" – TypeScript bị xem là không cần thiết/phức tạp.
**How to apply:** Mọi file backend phải là `.js`. Không cần tsconfig.json, ts-node, @types/*. Cấu trúc phải đơn giản và dễ đọc theo phong cách Express.js thông thường.
