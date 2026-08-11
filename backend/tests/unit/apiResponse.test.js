const { sendSuccess, sendError, paginationMeta } = require('../../src/utils/ApiResponse');

/** Response giả chỉ ghi lại những gì controller gọi. */
const fakeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('sendSuccess', () => {
  it('mặc định trả 200 với message "Success"', () => {
    const res = fakeRes();

    sendSuccess(res, { id: 1 });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Success', data: { id: 1 } });
  });

  it('bỏ hẳn khoá meta khi không có phân trang', () => {
    const res = fakeRes();

    sendSuccess(res, null, 'Đã xoá');

    expect(res.json.mock.calls[0][0]).not.toHaveProperty('meta');
  });

  it('gắn meta khi được truyền vào', () => {
    const res = fakeRes();

    sendSuccess(res, [], 'ok', 200, { pagination: { total: 0 } });

    expect(res.json.mock.calls[0][0].meta).toEqual({ pagination: { total: 0 } });
  });
});

describe('sendError', () => {
  it('luôn kèm code để client phân nhánh, không phải đọc message', () => {
    const res = fakeRes();

    sendError(res, 'Không tìm thấy', 404, 'NOT_FOUND');

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Không tìm thấy', code: 'NOT_FOUND' });
  });

  it('gắn chi tiết lỗi từng field khi có', () => {
    const res = fakeRes();

    sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', { email: ['Invalid email'] });

    expect(res.json.mock.calls[0][0].errors).toEqual({ email: ['Invalid email'] });
  });
});

describe('paginationMeta', () => {
  it('tính tổng số trang và cờ điều hướng', () => {
    expect(paginationMeta(25, 2, 10)).toEqual({
      total: 25, page: 2, limit: 10, totalPages: 3, hasNextPage: true, hasPrevPage: true,
    });
  });

  it('trang đầu không có trang trước', () => {
    expect(paginationMeta(5, 1, 10)).toMatchObject({ totalPages: 1, hasNextPage: false, hasPrevPage: false });
  });

  it('không còn bản ghi nào thì tổng số trang là 0', () => {
    expect(paginationMeta(0, 1, 10)).toMatchObject({ totalPages: 0, hasNextPage: false });
  });
});
