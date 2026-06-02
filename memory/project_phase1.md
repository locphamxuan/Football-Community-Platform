---
name: project-phase1
description: Football Community Platform – Phase 1 trạng thái và quyết định kỹ thuật
metadata:
  type: project
---

Backend sử dụng plain JavaScript (không TypeScript) + Express.js + Mongoose theo module-based structure.
**Why:** User yêu cầu "nodejs expressjs mongo thông thường" – TypeScript bị coi là quá phức tạp.
**How to apply:** Mọi file backend đều là `.js`, không dùng TypeScript, không cần tsconfig.

Frontend là Next.js 16.2.7 (không phải 15 như ban đầu nghĩ – create-next-app cài version mới nhất).
**Why:** `create-next-app@latest` tự cài Next.js 16. AGENTS.md trong frontend folder cảnh báo điều này.
**How to apply:** `useSearchParams()` phải bọc trong `<Suspense>`. `Select.onValueChange` trả `string | null`, cần null-check.

Phase 1 đã hoàn thành:
- Backend: auth, users, fields, bookings modules – tất cả plain JS
- Frontend: login, register, forgot-password, reset-password, fields search, field detail, my-bookings
- Docker + docker-compose.yml + GitHub Actions CI/CD skeleton
- Build frontend: PASS ✅

Cấu trúc backend:
- `backend/src/config/` – env, database, redis, cloudinary, email
- `backend/src/constants/` – httpStatus, errorCodes, roles
- `backend/src/middleware/` – authenticate, authorize, validate, errorHandler, rateLimiter, upload
- `backend/src/utils/` – logger, ApiResponse, catchAsync, jwt, bcrypt, email, pagination
- `backend/src/modules/{auth,users,fields,bookings}/` – mỗi module có model, service, controller, routes, validation
