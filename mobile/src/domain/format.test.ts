import { formatPrice, formatQuota } from './format';

describe('formatPrice', () => {
  it('hiển thị tiền Việt', () => {
    const out = formatPrice(299000);
    expect(out.replace(/\D/g, '')).toBe('299000');
    expect(out).toContain('₫');
  });
});

describe('formatQuota', () => {
  it('-1 nghĩa là không giới hạn', () => {
    expect(formatQuota(-1)).toBe('Không giới hạn');
  });

  it('số dương giữ nguyên', () => {
    expect(formatQuota(500)).toBe('500');
  });

  it('0 không bị nhầm thành không giới hạn', () => {
    expect(formatQuota(0)).toBe('0');
  });
});
