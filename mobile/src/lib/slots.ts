/**
 * Chọn khung giờ đặt sân — thuần tính toán, không chạm React.
 *
 * Các giới hạn ở đây phải khớp với `backend/src/services/booking.service.js`; lệch một chút
 * là người dùng chọn được khung giờ mà backend từ chối, và họ không hiểu vì sao.
 */
export const MIN_DURATION_HOURS = 0.5;
export const MAX_DURATION_HOURS = 6;

/** Bước chọn giờ. 30 phút vì thời lượng tối thiểu của backend cũng là 30 phút. */
const STEP_MINUTES = 30;

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Ngày YYYY-MM-DD theo lịch của máy — người dùng chọn "hôm nay" theo giờ của họ. */
export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export interface DayOption {
  key: string;
  label: string;
  dayLabel: string;
}

/** `count` ngày kể từ hôm nay — không cho chọn quá khứ vì backend cũng từ chối. */
export const dayOptions = (count = 14, from = new Date()): DayOption[] =>
  Array.from({ length: count }, (_, i) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    return {
      key: toDateKey(date),
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      dayLabel: i === 0 ? 'Hôm nay' : WEEKDAY_LABELS[date.getDay()],
    };
  });

/**
 * Giờ bắt đầu chọn được trong ngày: nằm trong giờ mở cửa, còn đủ chỗ cho buổi ngắn nhất,
 * và với hôm nay thì phải chưa trôi qua.
 */
export const startTimeOptions = (
  { open, close }: { open: string; close: string },
  dateKey: string,
  now = new Date()
): string[] => {
  const first = toMinutes(open);
  const last = toMinutes(close) - MIN_DURATION_HOURS * 60;
  const isToday = dateKey === toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const options: string[] = [];
  for (let m = first; m <= last; m += STEP_MINUTES) {
    if (isToday && m <= nowMinutes) continue;
    options.push(toTime(m));
  }
  return options;
};

/** Giờ kết thúc hợp lệ cho một giờ bắt đầu: từ 30 phút tới 6 tiếng, không quá giờ đóng cửa. */
export const endTimeOptions = (startTime: string, close: string): string[] => {
  const start = toMinutes(startTime);
  const closeAt = toMinutes(close);
  const options: string[] = [];

  for (let m = start + MIN_DURATION_HOURS * 60; m <= start + MAX_DURATION_HOURS * 60; m += STEP_MINUTES) {
    if (m > closeAt) break;
    options.push(toTime(m));
  }
  return options;
};

export const durationHours = (startTime: string, endTime: string) =>
  (toMinutes(endTime) - toMinutes(startTime)) / 60;

/** "1 tiếng 30 phút" — người Việt đọc thời lượng theo giờ và phút, không theo số thập phân. */
export const formatDuration = (hours: number) => {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (whole === 0) return `${minutes} phút`;
  return minutes === 0 ? `${whole} tiếng` : `${whole} tiếng ${minutes} phút`;
};
