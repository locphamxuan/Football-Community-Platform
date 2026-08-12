import { describe, expect, it } from 'vitest';
import { formatCompactPrice, formatDate, formatPrice, formatRelativeTime, initialsOf, toDateInput } from './format';

/** Intl chèn ký tự khoảng trắng đặc biệt — so sánh phần số cho ổn định giữa các môi trường. */
const digitsOf = (s: string) => s.replace(/\D/g, '');

describe('formatPrice', () => {
  it('hiển thị tiền Việt có ký hiệu đơn vị', () => {
    const out = formatPrice(200000);
    expect(digitsOf(out)).toBe('200000');
    expect(out).toContain('₫');
  });

  it('không hiện phần thập phân', () => {
    expect(formatPrice(199999.6)).not.toContain(',0');
  });
});

describe('formatCompactPrice', () => {
  it('rút gọn hàng triệu', () => {
    expect(formatCompactPrice(12_500_000)).toBe('12,5 tr');
  });

  it('rút gọn hàng tỷ', () => {
    expect(formatCompactPrice(2_400_000_000)).toBe('2,4 tỷ');
  });

  it('rút gọn hàng nghìn', () => {
    expect(formatCompactPrice(250_000)).toBe('250 k');
  });

  it('dưới một nghìn thì giữ nguyên dạng tiền đầy đủ', () => {
    expect(formatCompactPrice(0)).toContain('₫');
  });

  it('mốc chuyển đơn vị: đúng 1 triệu là "1 tr"', () => {
    expect(formatCompactPrice(1_000_000)).toBe('1 tr');
  });
});

describe('initialsOf', () => {
  it('lấy hai chữ cái cuối của họ tên', () => {
    expect(initialsOf('Phạm Xuân Lộc')).toBe('XL');
  });

  it('tên một chữ thì lấy một chữ cái', () => {
    expect(initialsOf('Lộc')).toBe('L');
  });

  it('chuỗi rỗng không làm vỡ hàm', () => {
    expect(initialsOf('')).toBe('?');
  });

  it('bỏ qua khoảng trắng thừa', () => {
    expect(initialsOf('  Nguyễn   Văn  An  ')).toBe('VA');
  });
});

describe('toDateInput', () => {
  it('trả về YYYY-MM-DD theo giờ địa phương, không lệch múi giờ', () => {
    // 23:30 địa phương: dùng toISOString sẽ nhảy sang ngày hôm sau ở múi giờ VN
    expect(toDateInput(new Date(2026, 7, 10, 23, 30))).toBe('2026-08-10');
  });

  it('đệm số 0 cho tháng và ngày một chữ số', () => {
    expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatDate', () => {
  it('hiển thị theo định dạng ngày/tháng/năm', () => {
    expect(formatDate('2026-08-10T00:00:00.000Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('formatRelativeTime', () => {
  it('mốc vài phút trước đọc bằng tiếng Việt, có hậu tố "trước"', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 phút trước');
  });

  it('mốc trong tương lai đọc bằng hậu tố "nữa"', () => {
    const inTwoHours = new Date(Date.now() + 2 * 3_600_000).toISOString();
    expect(formatRelativeTime(inTwoHours)).toBe('khoảng 2 giờ nữa');
  });
});
