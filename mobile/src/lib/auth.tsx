import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@fcp/shared';
import { authService, type LoginPayload } from '../services/auth.service';
import { notificationService } from '../services/notification.service';
import { setSessionExpiredHandler } from './authFetch';
import { registerForPushNotifications } from './push';
import { clearSession, restoreSession, saveSession } from './session';

interface AuthValue {
  user: User | null;
  /** Chưa đọc xong phiên đã lưu — đừng điều hướng trước lúc này, sẽ chớp màn đăng nhập. */
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Giữ token của thiết bị để gỡ đúng cái này lúc đăng xuất, không đụng thiết bị khác.
  const pushToken = useRef<string | null>(null);

  const registerDevice = useCallback(async () => {
    const token = await registerForPushNotifications();
    if (!token) return;
    pushToken.current = token;
    try {
      await notificationService.registerDevice(token);
    } catch {
      // Không đăng ký được thì chỉ mất thông báo đẩy, thông báo in-app vẫn còn nguyên.
    }
  }, []);

  const loadUser = useCallback(async () => {
    const { user: me } = await authService.me();
    setUser(me);
  }, []);

  // Mở app: khôi phục phiên đã lưu trong Keychain rồi lấy lại hồ sơ.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tokens = await restoreSession();
      if (tokens) {
        try {
          await loadUser();
          if (!cancelled) await registerDevice();
        } catch {
          await clearSession();
        }
      }
      if (!cancelled) setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [loadUser, registerDevice]);

  // Refresh token hỏng (hết hạn hoặc bị thu hồi) → về màn đăng nhập ngay, không treo màn trắng.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await authService.login(payload);
    await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    await registerDevice();
  }, [registerDevice]);

  const logout = useCallback(async () => {
    // Gỡ thiết bị trước khi phiên chết, nếu không backend vẫn đẩy thông báo về máy này.
    if (pushToken.current) {
      try {
        await notificationService.unregisterDevice(pushToken.current);
      } catch {
        // Token chết sẽ bị backend tự dọn khi Expo báo DeviceNotRegistered.
      }
      pushToken.current = null;
    }
    try {
      await authService.logout();
    } catch {
      // Đăng xuất phía server hỏng cũng không được giữ người dùng lại trong app.
    }
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, isLoading, login, logout, refreshUser: loadUser }),
    [user, isLoading, login, logout, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải nằm trong AuthProvider');
  return value;
};
