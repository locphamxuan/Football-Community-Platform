import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        sessionStorage.setItem('accessToken', accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      setToken: (accessToken) => {
        sessionStorage.setItem('accessToken', accessToken);
        set({ accessToken });
      },

      clearAuth: () => {
        sessionStorage.removeItem('accessToken');
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'fcp-auth',
      // Chỉ persist user (không persist token — token dùng sessionStorage)
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;
