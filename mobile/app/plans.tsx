import { Screen } from '../src/components/ui';
import PlansScreen from '../src/screens/PlansScreen';

/** Bảng giá thuê bao dành cho chủ sân — công khai, xem được cả khi chưa đăng nhập. */
export default function PlansRoute() {
  return (
    <Screen>
      <PlansScreen />
    </Screen>
  );
}
