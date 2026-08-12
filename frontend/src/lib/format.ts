import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const priceFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const formatPrice = (n: number) => priceFormatter.format(n);

/** Rút gọn tiền cho thẻ số liệu: 12.500.000 ₫ → "12,5 tr". */
export const formatCompactPrice = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} k`;
  return formatPrice(n);
};

export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Khoảng cách tới hiện tại, kiểu "2 giờ trước" — thông báo đọc bằng thời gian tương đối. */
export const formatRelativeTime = (d: string) =>
  formatDistanceToNow(new Date(d), { addSuffix: true, locale: vi });

export const formatDateLong = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Chữ cái đầu cho avatar dự phòng: "Phạm Xuân Lộc" → "XL". */
export const initialsOf = (name: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

/** Ngày local dạng YYYY-MM-DD (không dùng toISOString để tránh lệch múi giờ). */
export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
