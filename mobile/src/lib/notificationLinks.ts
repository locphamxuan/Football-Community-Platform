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
  '/match-requests': '/match-requests',
};

export const routeForLink = (link: string): string | undefined => ROUTE_FOR_LINK[link];
