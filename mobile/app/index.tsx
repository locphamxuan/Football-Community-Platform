import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { Loading, Screen } from '../src/components/ui';

/**
 * Cửa vào app. Tìm sân là màn hình công khai nên **không** chặn người chưa đăng nhập ở đây —
 * bắt đăng nhập trước khi cho xem gì cả là cách nhanh nhất để mất người dùng mới.
 * Từng màn cần phiên sẽ tự yêu cầu đăng nhập.
 */
export default function Index() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <Screen>
        <Loading label="Đang mở ứng dụng" />
      </Screen>
    );
  }

  return <Redirect href="/(tabs)/fields" />;
}
