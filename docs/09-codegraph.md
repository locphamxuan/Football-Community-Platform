# 09 — CodeGraph

[CodeGraph](https://github.com/colbymchenry/codegraph) dựng sẵn một đồ thị tri thức của
codebase — hàm, class, phụ thuộc, đường gọi — để AI agent trả lời câu hỏi về code bằng một
truy vấn thay vì mở lần lượt từng file.

Với repo này, ích lợi rõ nhất là lần theo chuỗi route → controller → service → model xuyên
qua bốn thư mục mà không phải grep mò.

## Cài đặt

```bash
npm i -g @colbymchenry/codegraph     # hoặc: irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex
codegraph init                       # tại thư mục gốc repo — dựng .codegraph/
codegraph install --target claude     # nối MCP server vào Claude Code
```

`codegraph init` đã chạy cho repo này (270 file, ~2.783 node, ~7.515 cạnh tính tới
2026-08-22 — con số này chỉ để biết quy mô, không cần theo dõi chính xác). Sau lần đầu,
index tự đồng bộ qua file watcher của hệ điều hành; `codegraph status` báo "up to date"
nếu watcher vẫn sống, còn nghi ngờ thì `codegraph sync` chạy tay cũng được.

## Những gì đã đưa vào repo

| Đường dẫn | Nội dung | Có commit? |
|---|---|---|
| `.mcp.json` | Khai báo MCP server ở mức dự án — ai clone repo cũng dùng được | ✅ |
| `.codegraph/` | Index SQLite cục bộ | ❌ (`.gitignore`) |
| `.claude/` | Cấu hình agent của từng máy | ❌ (đã ignore từ trước) |

Telemetry đã tắt (`codegraph telemetry off`).

## Dùng thế nào

Từ dòng lệnh:

```bash
codegraph explore "cancelBooking"        # nguồn của symbol + đường gọi liên quan
codegraph node calcPrice                 # một symbol: nguồn + chuỗi gọi tới/đi
codegraph callers calcPrice              # ai gọi hàm này
codegraph impact assertCanCreateField    # đổi hàm này thì ảnh hưởng những đâu
codegraph affected src/services/billing/owner.js      # file test nào liên quan
codegraph files                          # cấu trúc dự án theo index
```

Trong Claude Code, MCP tool `codegraph_explore` trả về đúng những thứ đó trong một lần gọi.

## Lưu ý

- Index **không** thay được việc đọc file trước khi sửa — nó chỉ giúp tìm đúng chỗ cần đọc.
- Index nằm ngoài git nên máy mới phải `codegraph init` lại; đây là việc mỗi lập trình viên
  tự quyết, không bắt buộc.
- Không có `.codegraph/` thì mọi thứ vẫn chạy bình thường; CodeGraph thuần tuý là công cụ hỗ trợ.
