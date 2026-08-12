import {
  MAX_DURATION_HOURS,
  MIN_DURATION_HOURS,
  dayOptions,
  durationHours,
  endTimeOptions,
  formatDuration,
  startTimeOptions,
  toDateKey,
  toMinutes,
  toTime,
} from './slots';

const HOURS = { open: '06:00', close: '22:00' };

describe('toMinutes / toTime', () => {
  it('đi và về không mất mát', () => {
    expect(toTime(toMinutes('18:30'))).toBe('18:30');
  });

  it('nửa đêm là 0 phút', () => {
    expect(toMinutes('00:00')).toBe(0);
  });
});

describe('dayOptions', () => {
  it('ngày đầu tiên là hôm nay, không có ngày quá khứ', () => {
    const days = dayOptions(3, new Date('2026-08-12T10:00:00'));

    expect(days).toHaveLength(3);
    expect(days[0].dayLabel).toBe('Hôm nay');
    expect(days[0].key).toBe('2026-08-12');
    expect(days[2].key).toBe('2026-08-14');
  });

  it('nhảy đúng qua ranh giới tháng', () => {
    const days = dayOptions(2, new Date('2026-08-31T10:00:00'));

    expect(days[1].key).toBe('2026-09-01');
  });
});

describe('startTimeOptions', () => {
  it('nằm trong giờ mở cửa và chừa đủ chỗ cho buổi ngắn nhất', () => {
    const options = startTimeOptions(HOURS, '2026-12-25', new Date('2026-08-12T10:00:00'));

    expect(options[0]).toBe('06:00');
    // 22:00 đóng cửa, buổi ngắn nhất 30 phút → giờ bắt đầu cuối cùng là 21:30
    expect(options[options.length - 1]).toBe('21:30');
  });

  it('với hôm nay thì bỏ các khung giờ đã trôi qua', () => {
    const now = new Date('2026-08-12T19:10:00');
    const options = startTimeOptions(HOURS, toDateKey(now), now);

    expect(options[0]).toBe('19:30');
    expect(options).not.toContain('19:00');
  });

  it('hôm nay đã quá giờ đóng cửa thì không còn lựa chọn nào', () => {
    const now = new Date('2026-08-12T23:30:00');

    expect(startTimeOptions(HOURS, toDateKey(now), now)).toEqual([]);
  });
});

describe('endTimeOptions', () => {
  it('bắt đầu từ thời lượng tối thiểu', () => {
    const options = endTimeOptions('18:00', '22:00');

    expect(options[0]).toBe('18:30');
    expect(durationHours('18:00', options[0])).toBe(MIN_DURATION_HOURS);
  });

  it('không vượt quá giờ đóng cửa', () => {
    const options = endTimeOptions('21:00', '22:00');

    expect(options).toEqual(['21:30', '22:00']);
  });

  it('không vượt quá thời lượng tối đa của backend', () => {
    const options = endTimeOptions('06:00', '22:00');
    const last = options[options.length - 1];

    expect(durationHours('06:00', last)).toBe(MAX_DURATION_HOURS);
  });
});

describe('formatDuration', () => {
  it.each([
    [0.5, '30 phút'],
    [1, '1 tiếng'],
    [1.5, '1 tiếng 30 phút'],
    [3, '3 tiếng'],
  ])('%s giờ → %s', (hours, expected) => {
    expect(formatDuration(hours)).toBe(expected);
  });
});
