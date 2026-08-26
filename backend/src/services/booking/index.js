const {
  calcPrice, calcDuration, resolvePricingForDate, calcBookingPrice,
} = require('../pricing.service');
const { dayRangeUtc } = require('./helpers');
const player = require('./player');
const manager = require('./manager');
const owner = require('./owner');
const shared = require('./shared');

module.exports = {
  ...player,
  ...manager,
  ...owner,
  ...shared,
  dayRangeUtc,
  // Re-exported từ pricing.service.js để giữ tương thích ngược cho code/test đang
  // `require('./booking')` để lấy các hàm tính giá — không định nghĩa lại ở đây.
  calcPrice, calcDuration, resolvePricingForDate, calcBookingPrice,
};
