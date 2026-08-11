import { describe, it, expect, beforeEach } from 'vitest';
import type { User } from '@/types';
import useAuthStore from './authStore';

const probeUser = { _id: '1', username: 'probe', email: 'probe@example.com' } as unknown as User;

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
});

describe('setAuth', () => {
  it('lưu người dùng và bật cờ đã đăng nhập', () => {
    useAuthStore.getState().setAuth(probeUser, 'token-abc');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(probeUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('đẩy token sang sessionStorage cho interceptor của axios đọc', () => {
    useAuthStore.getState().setAuth(probeUser, 'token-abc');

    expect(sessionStorage.getItem('accessToken')).toBe('token-abc');
  });
});

describe('setToken', () => {
  it('thay token mà không đụng tới hồ sơ người dùng', () => {
    useAuthStore.getState().setAuth(probeUser, 'token-cu');

    useAuthStore.getState().setToken('token-moi');

    expect(useAuthStore.getState().accessToken).toBe('token-moi');
    expect(useAuthStore.getState().user).toEqual(probeUser);
    expect(sessionStorage.getItem('accessToken')).toBe('token-moi');
  });
});

describe('clearAuth', () => {
  it('xoá sạch cả state lẫn sessionStorage', () => {
    useAuthStore.getState().setAuth(probeUser, 'token-abc');

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState()).toMatchObject({ user: null, accessToken: null, isAuthenticated: false });
    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });
});

describe('persist', () => {
  it('không ghi token vào localStorage — token chỉ sống trong sessionStorage', () => {
    useAuthStore.getState().setAuth(probeUser, 'token-bi-mat');

    expect(localStorage.getItem('fcp-auth') ?? '').not.toContain('token-bi-mat');
  });
});
