import { ApiError } from './api';
import { isValidationError, messageOf } from './errors';

describe('messageOf', () => {
  it('dùng thẳng message tiếng Việt của backend', () => {
    expect(messageOf(new ApiError('Sân đã có người đặt khung giờ này', 409))).toBe(
      'Sân đã có người đặt khung giờ này'
    );
  });

  it('thay lỗi mạng của fetch bằng câu người dùng hiểu được', () => {
    expect(messageOf(new Error('Network request failed'))).toBe(
      'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
    );
  });

  it('có câu mặc định cho thứ không phải Error', () => {
    expect(messageOf('bỗng dưng là chuỗi')).toBe('Có lỗi xảy ra, vui lòng thử lại.');
  });
});

describe('isValidationError', () => {
  it('nhận ra lỗi do dữ liệu người dùng nhập', () => {
    expect(isValidationError(new ApiError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR'))).toBe(
      true
    );
  });

  it('không nhầm lỗi hệ thống là lỗi nhập liệu', () => {
    expect(isValidationError(new ApiError('Không có quyền', 403, 'FORBIDDEN'))).toBe(false);
    expect(isValidationError(new Error('Network request failed'))).toBe(false);
  });
});
