import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Đăng ký thiết bị nhận thông báo đẩy của Expo.
 *
 * Trả `null` thay vì ném lỗi ở mọi nhánh hỏng: không có thông báo đẩy là bất tiện,
 * còn app không mở được vì chuyện đó thì mới là hỏng. Nhánh hỏng gồm cả máy ảo
 * (không có thiết bị thật thì không có token) và Expo Go trên Android từ SDK 53 —
 * ở đó phải dùng development build.
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) return null;

  try {
    // Android 13+ chỉ hiện hộp xin quyền sau khi app đã tạo ít nhất một kênh thông báo.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Thông báo',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const status = existing.granted
      ? existing
      : await Notifications.requestPermissionsAsync();
    if (!status.granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
};

/** App đang mở thì vẫn hiện banner — nếu không, thông báo tới lúc đang dùng app sẽ mất hút. */
export const configureNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
};
