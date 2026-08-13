import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth';
import { configureNotificationHandler } from '../src/lib/push';
import { colors } from '../src/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      // Mạng di động chập chờn hơn Wi-Fi: quay lại app là lấy lại dữ liệu mới.
      refetchOnMount: true,
    },
  },
});

export default function RootLayout() {
  useEffect(configureNotificationHandler, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="fields/[id]/index" options={{ title: 'Chi tiết sân' }} />
            <Stack.Screen name="fields/[id]/book" options={{ title: 'Đặt sân' }} />
            <Stack.Screen name="teams/[id]" options={{ title: 'Đội bóng' }} />
            <Stack.Screen name="teams/create" options={{ title: 'Tạo đội' }} />
            <Stack.Screen name="match-requests" options={{ title: 'Lời mời thi đấu' }} />
            <Stack.Screen name="plans" options={{ title: 'Gói thuê bao' }} />
            <Stack.Screen name="notification-settings" options={{ title: 'Cài đặt thông báo' }} />
            <Stack.Screen name="owner/bookings" options={{ title: 'Lịch đặt sân' }} />
            <Stack.Screen name="owner/fields" options={{ title: 'Sân của tôi' }} />
            <Stack.Screen name="owner/reviews" options={{ title: 'Đánh giá' }} />
            <Stack.Screen name="owner/billing" options={{ title: 'Gói thuê bao' }} />
            <Stack.Screen name="team/bookings" options={{ title: 'Lịch sân của đội' }} />
          </Stack>
          <StatusBar style="dark" />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
