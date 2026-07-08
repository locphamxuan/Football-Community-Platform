import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Trả về true sau khi hydrate xong trên client.
 * Dùng để tránh hydration mismatch với dữ liệu chỉ có ở client
 * (theme, auth store persist...). Không dùng setState trong effect.
 */
export default function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
