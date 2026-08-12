/**
 * Token giao diện dùng chung. Không có thư viện UI nào ở đây — mọi màn hình
 * đọc từ file này để màu và khoảng cách không trôi mỗi màn một kiểu.
 */
export const colors = {
  primary: '#15803d',
  primarySoft: '#dcfce7',
  background: '#ffffff',
  surface: '#f4f4f5',
  border: '#e4e4e7',
  text: '#18181b',
  textMuted: '#52525b',
  textSubtle: '#a1a1aa',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  info: '#1d4ed8',
  infoSoft: '#dbeafe',
  white: '#ffffff',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const fontSize = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24 } as const;

/** Màu nền / chữ cho từng trạng thái, dùng chung cho booking, lời mời và hoá đơn. */
export const statusTone = {
  neutral: { background: colors.surface, text: colors.textMuted },
  pending: { background: colors.warningSoft, text: colors.warning },
  active: { background: colors.infoSoft, text: colors.info },
  done: { background: colors.primarySoft, text: colors.primary },
  failed: { background: colors.dangerSoft, text: colors.danger },
} as const;

export type StatusTone = keyof typeof statusTone;
