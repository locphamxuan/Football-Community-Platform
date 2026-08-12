import { ApiError } from './api';

/**
 * Thông điệp hiện cho người dùng.
 *
 * Backend đã viết message bằng tiếng Việt cho các lỗi nghiệp vụ, nên dùng thẳng.
 * Lỗi mạng thì `fetch` chỉ ném "Network request failed" — vô nghĩa với người dùng,
 * nên thay bằng câu nói rõ phải làm gì.
 */
export const messageOf = (err: unknown): string => {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  return 'Có lỗi xảy ra, vui lòng thử lại.';
};

/** Lỗi do dữ liệu người dùng nhập, không phải sự cố hệ thống. */
export const isValidationError = (err: unknown) =>
  err instanceof ApiError && err.code === 'VALIDATION_ERROR';
