/**
 * Backend gắn vào mỗi thông báo một `link` là đường dẫn của **web**. Bảng này dịch sang
 * route mobile tương ứng; link nào chưa có màn hình thì trả `undefined` — mở thông báo
 * chỉ đánh dấu đã đọc, không nhảy đi đâu, còn hơn đưa người dùng tới nhầm chỗ.
 *
 * Thêm màn hình mới cho một vai trò thì phải quay lại đây: `/owner/bookings` từng trỏ về
 * tab lịch đặt của người chơi, nên chủ sân bấm "có lịch đặt mới" lại thấy lịch của chính mình.
 */
const ROUTE_FOR_LINK: Record<string, string> = {
  '/bookings': '/(tabs)/bookings',
  '/owner/bookings': '/owner/bookings',
  '/owner/billing': '/owner/billing',
  '/match-requests': '/match-requests',
  '/chat': '/(tabs)/chat',
};

/**
 * Thông báo tin nhắn mang theo mã cuộc trò chuyện (`/chat/<id>`) nên không tra bảng được.
 * Mobile đặt khung chat ở đúng đường dẫn ấy, nên link web dùng lại nguyên vẹn — chỉ cần
 * chắc phần đuôi là một mã, không phải một đoạn đường dẫn nào khác lọt vào.
 */
const CHAT_THREAD_LINK = /^\/chat\/[A-Za-z0-9_-]+$/;

export const routeForLink = (link: string): string | undefined => {
  if (CHAT_THREAD_LINK.test(link)) return link;
  return ROUTE_FOR_LINK[link];
};
