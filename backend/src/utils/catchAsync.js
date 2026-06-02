/**
 * Wrapper cho async route handlers — tự động chuyển lỗi đến next()
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
