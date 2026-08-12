import { ApiError, apiFetch, type RequestOptions } from './api';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './session';

/**
 * Gọi API bằng phiên đang đăng nhập, tự làm mới access token khi hết hạn.
 *
 * Access token chỉ sống 15 phút, còn app di động thì nằm trong túi hàng giờ liền — nếu
 * không tự làm mới thì người dùng bị đá ra đăng nhập lại mỗi lần mở app.
 */

let refreshing: Promise<string | null> | null = null;
let onExpired: (() => void) | null = null;

/** Cho AuthProvider biết phiên đã chết hẳn để đưa người dùng về màn đăng nhập. */
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onExpired = handler;
};

/** Một lần làm mới thật sự. Trả `null` nghĩa là phiên đã chết, phải đăng nhập lại. */
const requestFreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const data = await apiFetch<{ accessToken: string; refreshToken?: string }>(
      '/auth/refresh-token',
      { method: 'POST', body: { refreshToken } }
    );
    await saveSession({
      accessToken: data.accessToken,
      // Backend xoay vòng refresh token; giữ cái cũ là lần sau bị từ chối.
      refreshToken: data.refreshToken ?? refreshToken,
    });
    return data.accessToken;
  } catch {
    await clearSession();
    onExpired?.();
    return null;
  }
};

/**
 * Nhiều request cùng 401 một lúc là chuyện thường khi mở app. Gom chung vào một lần
 * làm mới; nếu mỗi request tự gọi refresh thì token xoay vòng của backend sẽ coi các
 * lần sau là token dùng lại và huỷ sạch phiên.
 */
const refreshAccessToken = (): Promise<string | null> => {
  // Cờ được dọn trong `.finally` chứ không phải trong thân hàm async: nhánh không có
  // refresh token chạy hết mà không hề `await`, nên phép gán `refreshing = ...` xảy ra
  // *sau* lúc dọn và ghi đè lại — cờ kẹt mãi và từ đó không lần nào làm mới được nữa.
  refreshing ??= requestFreshAccessToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
};

export async function authFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await apiFetch<T>(path, { ...options, token: getAccessToken() });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    const accessToken = await refreshAccessToken();
    if (!accessToken) throw err;

    return apiFetch<T>(path, { ...options, token: accessToken });
  }
}
