import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/constants';

/**
 * Kết nối WebSocket tới backend — một cái cho cả tab, không phải một cái cho mỗi component.
 *
 * Socket.io gắn vào chính server đang phục vụ REST, nên địa chỉ là `API_URL` bỏ đi phần
 * tiền tố phiên bản: `http://host/api/v1` → `http://host`.
 */
const SOCKET_URL = API_URL.replace(/\/api\/v\d+\/?$/, '');

let socket: Socket | null = null;

/**
 * Socket đang mở, hoặc mở mới khi chưa có.
 *
 * Không còn `auth.token` nào để gắn bằng tay: access token nằm trong cookie `httpOnly`,
 * JS trên trang không đọc được. `withCredentials: true` khiến trình duyệt tự đính kèm cookie
 * đó ở request bắt tay (kể cả sau khi tự kết nối lại), nên backend luôn thấy token mới nhất
 * mà client không cần tự làm mới gì cả — xem `backend/src/socket/auth.js`.
 */
export const getChatSocket = (): Socket => {
  socket ??= io(SOCKET_URL, { withCredentials: true });
  return socket;
};

export const closeChatSocket = () => {
  socket?.disconnect();
  socket = null;
};
