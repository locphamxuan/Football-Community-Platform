import { Stack } from 'expo-router';
import { colors } from '../../src/lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Đăng nhập' }} />
      <Stack.Screen name="register" options={{ title: 'Tạo tài khoản' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Quên mật khẩu' }} />
    </Stack>
  );
}
