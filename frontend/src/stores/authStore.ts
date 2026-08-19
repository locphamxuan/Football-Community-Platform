import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

/**
 * Access token không đi qua store này nữa — nó nằm trong cookie `httpOnly` do backend đặt,
 * JS trên trang không đọc/ghi được (kể cả bị XSS). `api.ts` gửi cookie tự động
 * (`withCredentials: true`), không cần gắn Authorization bằng tay.
 */
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) => set({ user, isAuthenticated: true }),

      clearAuth: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'fcp-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;
