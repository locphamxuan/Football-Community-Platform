const { z } = require('zod');
const { NOTIFICATION_TYPES } = require('../constants/notifications');

const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  // Chuỗi chứ không phải boolean: query string không có kiểu, và service so sánh với 'true'
  unread: z.enum(['true', 'false']).optional(),
  // Loại lạ phải bị chặn ở đây, nếu không nó lọt xuống filter và trả về danh sách rỗng
  // trông y hệt "bạn không có thông báo nào" — người gọi API không biết mình gõ sai.
  type: z.enum(NOTIFICATION_TYPES).optional(),
});

module.exports = { notificationQuerySchema };
