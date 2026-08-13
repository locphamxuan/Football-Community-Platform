import { routeForLink } from './notificationLinks';

describe('routeForLink', () => {
  it('lịch đặt của người chơi về tab lịch đặt', () => {
    expect(routeForLink('/bookings')).toBe('/(tabs)/bookings');
  });

  it('lịch đặt của chủ sân về màn quản lý, không phải tab người chơi', () => {
    expect(routeForLink('/owner/bookings')).toBe('/owner/bookings');
  });

  it('link chưa có màn hình thì không điều hướng', () => {
    expect(routeForLink('/owner/billing')).toBeUndefined();
    expect(routeForLink('')).toBeUndefined();
  });
});
