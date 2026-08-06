---
name: feedback-branch-per-task
description: Mỗi lần làm chức năng mới hoặc sửa gì đó thì phải checkout nhánh git mới trước khi bắt đầu
metadata:
  type: feedback
---

Bất kỳ việc mới nào — thêm chức năng, sửa bug, đổi config, sửa docs — đều phải `git checkout -b` một nhánh mới **trước khi** chạm vào file. Không làm tiếp trên nhánh của việc trước đã push.
**Why:** User yêu cầu ngày 2026-08-07: "lần sau làm chức năng mới, sửa gì thì checkout nhánh git mới". Trước đó có lúc tôi commit thêm rule/docs vào nhánh `feature/fullstack-owner-dashboard` đã push xong, làm nhánh đó lẫn nhiều mối quan tâm.
**How to apply:** Đặt tên nhánh theo việc: `feature/...`, `fix/...`, `chore/...`, `docs/...`. Nhánh gốc thường là nhánh hiện tại nếu việc mới phụ thuộc code chưa merge, ngược lại thì từ `main`. Không bao giờ commit trực tiếp lên `main`. Xem thêm [[feedback-commit-style]] và [[feedback-verify-before-commit]].
