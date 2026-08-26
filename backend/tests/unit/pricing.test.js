const { calcPrice, calcDuration } = require('../../src/services/booking');

// 2026-08-10 là thứ hai, 2026-08-15 là thứ bảy (tính theo UTC như calcPrice)
const MONDAY = '2026-08-10';
const SATURDAY = '2026-08-15';

const pricing = {
  weekday: { morning: 100000, afternoon: 200000, evening: 300000 },
  weekend: { morning: 150000, afternoon: 250000, evening: 400000 },
};

describe('calcDuration', () => {
  it('trả về số giờ giữa hai mốc', () => {
    expect(calcDuration('18:00', '20:00')).toBe(2);
  });

  it('tính được khung lẻ 30 phút', () => {
    expect(calcDuration('18:00', '19:30')).toBe(1.5);
  });
});

describe('calcPrice', () => {
  it('tính trọn vẹn trong một khung giá', () => {
    // 19:00–21:00 nằm hết trong khung tối (18:00–24:00)
    expect(calcPrice(pricing, MONDAY, '19:00', '21:00')).toBe(600000);
  });

  it('chia giá theo phần thời gian thực nằm trong từng khung', () => {
    // 17:00–20:00 = 1h chiều (200k) + 2h tối (600k) — không phải 3h giá chiều
    expect(calcPrice(pricing, MONDAY, '17:00', '20:00')).toBe(800000);
  });

  it('bắc qua ba khung giá trong ngày', () => {
    // 11:00–19:00 = 1h sáng + 6h chiều + 1h tối
    expect(calcPrice(pricing, MONDAY, '11:00', '19:00')).toBe(100000 + 1200000 + 300000);
  });

  it('dùng bảng giá cuối tuần vào thứ bảy', () => {
    expect(calcPrice(pricing, SATURDAY, '19:00', '21:00')).toBe(800000);
  });

  it('tính đúng khung nửa tiếng', () => {
    expect(calcPrice(pricing, MONDAY, '18:00', '18:30')).toBe(150000);
  });

  it('trả về 0 khi giờ kết thúc không sau giờ bắt đầu', () => {
    expect(calcPrice(pricing, MONDAY, '19:00', '19:00')).toBe(0);
  });
});
