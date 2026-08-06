---
name: feedback-verify-before-commit
description: Luôn chạy kiểm tra cho cả backend và frontend trước khi commit, rồi tự commit và tự push
metadata:
  type: feedback
---

Trước mỗi commit phải kiểm tra **cả backend và frontend**, kiểm tra xong một lượt thì tự commit và tự push (message tiếng Anh).
**Why:** User yêu cầu ngày 2026-08-07: "luôn luôn chạy testing cho cả be và fe, các commit sau khi kiểm tra một lượt thì tự commit và tự push bằng tiếng anh". Trước đó rule chỉ commit local, không push.
**How to apply:** Backend — `npm run lint`, rồi chạy thật: `docker compose up -d redis` (server **không boot được** nếu thiếu Redis) + `node src/server.js`, gọi các endpoint bị ảnh hưởng kèm cả case 401/403 và case validation lỗi. Frontend — `npx tsc --noEmit`, `npm run lint`, `npm run build`, cả ba phải pass. Chưa có test runner nào được cấu hình (`backend/tests/` rỗng, frontend không có test script) nên các lệnh trên là gate; nếu sau này thêm suite thì chạy luôn. Xoá script probe / log tạm sau khi kiểm tra. Xem thêm [[feedback-commit-style]].
