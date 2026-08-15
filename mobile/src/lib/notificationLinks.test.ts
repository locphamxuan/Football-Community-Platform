import { routeForLink } from './notificationLinks';

describe('routeForLink', () => {
  it('lịch đặt của người chơi về tab lịch đặt', () => {
    expect(routeForLink('/bookings')).toBe('/(tabs)/bookings');
  });

  it('lịch đặt của chủ sân về màn quản lý, không phải tab người chơi', () => {
    expect(routeForLink('/owner/bookings')).toBe('/owner/bookings');
  });

  it('hoá đơn mới mở thẳng trang thuê bao', () => {
    expect(routeForLink('/owner/billing')).toBe('/owner/billing');
  });

  it('tin nhắn mới mở thẳng đúng cuộc trò chuyện', () => {
    expect(routeForLink('/chat/64f0c0ffee')).toBe('/chat/64f0c0ffee');
  });

  it('link chat trống mã thì về hộp thư', () => {
    expect(routeForLink('/chat')).toBe('/(tabs)/chat');
  });

  // Mã hội thoại đi thẳng vào đường dẫn: một đoạn lạ lọt vào là một route không tồn tại.
  it('link chat có thêm đoạn đường dẫn thì không điều hướng', () => {
    expect(routeForLink('/chat/c1/messages')).toBeUndefined();
    expect(routeForLink('/chat/')).toBeUndefined();
  });

  it('link chưa có màn hình thì không điều hướng', () => {
    expect(routeForLink('/admin/invoices')).toBeUndefined();
    expect(routeForLink('')).toBeUndefined();
  });
});
