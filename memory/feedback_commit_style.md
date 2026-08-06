---
name: feedback-commit-style
description: Tách commit theo từng phần hợp lý, message tiếng Anh, và tự động commit không cần đợi lệnh
metadata:
  type: feedback
---

Chia thay đổi thành nhiều commit nhỏ hợp lý (mỗi commit một mối quan tâm), viết message bằng tiếng Anh theo Conventional Commits, và tự động commit ngay khi hoàn thành một phần việc — không cần đợi user ra lệnh.
**Why:** User yêu cầu rõ ràng ngày 2026-08-06: "tách commit ra cho hợp lý (bằng tiếng anh) và commit luôn không cần đợi lệnh của tôi". Lịch sử git trước đó có commit gộp nhiều thứ (ví dụ `eat: booking creation flow + profile field cleanup`) và cả typo prefix.
**How to apply:** Sau mỗi phần việc hoàn chỉnh: `git add` đúng nhóm file liên quan rồi commit với prefix `feat/fix/refactor/chore/docs/test` + scope. Không gộp backend + frontend + config vào một commit nếu chúng không thuộc cùng một thay đổi. Từ 2026-08-07 user yêu cầu **push luôn** sau khi commit (trước đó là chỉ commit local) — nhưng mở PR vẫn cần được yêu cầu rõ ràng. Xem thêm [[feedback-verify-before-commit]] và [[feedback-backend-js]].
