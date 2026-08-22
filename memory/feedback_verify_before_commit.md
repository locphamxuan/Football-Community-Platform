---
name: feedback-verify-before-commit
description: Luôn chạy kiểm tra cho cả backend và frontend trước khi commit, rồi tự commit và tự push
metadata:
  type: feedback
---

Trước mỗi commit phải kiểm tra **cả backend và frontend**, kiểm tra xong một lượt thì tự commit và tự push (message tiếng Anh).
**Why:** User yêu cầu ngày 2026-08-07: "luôn luôn chạy testing cho cả be và fe, các commit sau khi kiểm tra một lượt thì tự commit và tự push bằng tiếng anh". Trước đó rule chỉ commit local, không push.
**How to apply:** Từ khi có test suite (Jest ở backend/mobile, Vitest ở frontend — xem `docs/06-kiem-thu.md`), gate chuẩn là `npm run lint && npm test` mỗi phía, đã ghi lại đầy đủ trong `CLAUDE.md` gốc repo — đọc ở đó thay vì chép lại đây, để không lệch lần nữa như bản cũ của file này (từng ghi "chưa có test runner", sai từ lâu). Với thay đổi ở service/controller, còn nên chạy thật: `docker compose up -d redis` (server **không boot được** nếu thiếu Redis) + `node src/server.js`, gọi endpoint bị ảnh hưởng kèm case 401/403/400. Xoá script probe / log tạm sau khi kiểm tra. Xem thêm [[feedback-commit-style]].
