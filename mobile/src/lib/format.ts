const priceFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const formatPrice = (n: number) => priceFormatter.format(n);

/** Hạn mức -1 nghĩa là không giới hạn (xem shared/types.ts, Plan.includedBookingsPerMonth). */
export const formatQuota = (n: number) => (n < 0 ? 'Không giới hạn' : String(n));
