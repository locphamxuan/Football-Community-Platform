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
 * `auth` là **hàm** chứ không phải object: server xác thực một lần lúc bắt tay, còn access
 * token chỉ sống 15 phút và được `api.ts` lặng lẽ làm mới. Chốt cứng token lúc mở kết nối
 * nghĩa là mỗi lần kết nối lại sau đó đều mang theo một token đã chết. Hàm này được gọi
 * trước *mỗi* lần thử kết nối, nên luôn lấy được token mới nhất.
 */
export const getChatSocket = (): Socket => {
  socket ??= io(SOCKET_URL, {
    auth: (cb) => cb({ token: sessionStorage.getItem('accessToken') ?? '' }),
    // Cookie refresh đi kèm ở giai đoạn polling, giống mọi request REST.
    withCredentials: true,
  });
  return socket;
};

export const closeChatSocket = () => {
  socket?.disconnect();
  socket = null;
};
