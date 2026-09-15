/**
 * Escape ký tự đặc biệt trước khi nhét chuỗi người dùng nhập vào `new RegExp`/`$regex`.
 *
 * Không escape thì một chuỗi như `(a+)+!` biến ô tìm kiếm thành ReDoS: MongoDB phải
 * backtrack theo cấp số nhân để kết luận không khớp, và endpoint này không cần đăng
 * nhập — bất kỳ ai cũng gọi được.
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegex };
