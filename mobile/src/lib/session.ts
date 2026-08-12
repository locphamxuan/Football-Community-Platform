import * as SecureStore from 'expo-secure-store';

/**
 * Nơi duy nhất giữ token của phiên đăng nhập.
 *
 * Token nằm trong Keychain (iOS) / Keystore (Android) chứ **không** phải AsyncStorage:
 * AsyncStorage là file thường, đọc được trên máy đã root hoặc qua bản sao lưu.
 * Bản sao trong RAM chỉ để `apiFetch` không phải chờ I/O trên mỗi request.
 */
const ACCESS_KEY = 'fcp.accessToken';
const REFRESH_KEY = 'fcp.refreshToken';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

let tokens: SessionTokens | null = null;

export const getAccessToken = () => tokens?.accessToken ?? null;
export const getRefreshToken = () => tokens?.refreshToken ?? null;

/** Đọc phiên đã lưu lúc mở app. Keychain lỗi thì coi như chưa đăng nhập, không làm vỡ app. */
export const restoreSession = async (): Promise<SessionTokens | null> => {
  try {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    // Thiếu refresh token thì access token sống được nhiều nhất 15 phút rồi tắc — coi như chưa đăng nhập.
    tokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
    return tokens;
  } catch {
    tokens = null;
    return null;
  }
};

export const saveSession = async (next: SessionTokens) => {
  tokens = next;
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, next.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, next.refreshToken),
    ]);
  } catch {
    // Ghi hỏng thì phiên chỉ sống trong RAM: người dùng vẫn dùng được app tới khi đóng.
  }
};

export const clearSession = async () => {
  tokens = null;
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  } catch {
    // Đã xoá khỏi RAM là đủ để đăng xuất phiên hiện tại.
  }
};
