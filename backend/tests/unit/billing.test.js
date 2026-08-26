const { addMonths, monthRange } = require('../../src/services/billing');
const { PLANS, PLAN_CODES, getPlan, PlanCode } = require('../../src/constants/plans');
const { getPagination } = require('../../src/utils/pagination');

describe('addMonths', () => {
  it('cộng thêm một tháng', () => {
    expect(addMonths(new Date('2026-08-10T00:00:00'), 1).getMonth()).toBe(8); // tháng 9
  });

  it('lùi về ngày cuối tháng khi tháng đích ngắn hơn', () => {
    const d = addMonths(new Date('2026-01-31T00:00:00'), 1);
    expect(d.getMonth()).toBe(1); // tháng 2
    expect(d.getDate()).toBe(28);
  });

  it('nhảy sang năm sau khi vượt tháng 12', () => {
    const d = addMonths(new Date('2026-12-15T00:00:00'), 1);
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0);
  });
});

describe('monthRange', () => {
  it('trả về mốc đầu tháng này và đầu tháng sau', () => {
    const { start, end } = monthRange(new Date('2026-08-10T13:45:00'));
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(7);
    expect(end.getDate()).toBe(1);
    expect(end.getMonth()).toBe(8);
  });
});

describe('bảng giá gói', () => {
  it('mọi gói đều khai báo đủ hạn mức', () => {
    for (const code of PLAN_CODES) {
      const plan = PLANS[code];
      expect(typeof plan.monthlyPrice).toBe('number');
      expect(plan.maxFields).toBeGreaterThan(0);
      expect(plan.maxSubFieldsPerField).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('gói miễn phí có giá 0', () => {
    expect(getPlan(PlanCode.FREE).monthlyPrice).toBe(0);
  });

  it('mã gói lạ rơi về gói miễn phí thay vì undefined', () => {
    expect(getPlan('diamond')).toBe(PLANS[PlanCode.FREE]);
  });

  it('gói đắt hơn thì hạn mức không thấp hơn', () => {
    const sorted = PLAN_CODES.map((c) => PLANS[c]).sort((a, b) => a.monthlyPrice - b.monthlyPrice);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].maxFields).toBeGreaterThanOrEqual(sorted[i - 1].maxFields);
    }
  });
});

describe('getPagination', () => {
  it('mặc định trang 1, 10 bản ghi', () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('tính skip theo trang', () => {
    expect(getPagination({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it('chặn limit vượt 100 và page nhỏ hơn 1', () => {
    expect(getPagination({ page: '0', limit: '999' })).toEqual({ page: 1, limit: 100, skip: 0 });
  });
});
