import { describe, it, expect, beforeEach } from 'vitest';
import type { User } from '@/types';
import useAuthStore from './authStore';

const probeUser = { _id: '1', username: 'probe', email: 'probe@example.com' } as unknown as User;

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

describe('setAuth', () => {
  it('lưu người dùng và bật cờ đã đăng nhập', () => {
    useAuthStore.getState().setAuth(probeUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(probeUser);
    expect(state.isAuthenticated).toBe(true);
  });
});

describe('clearAuth', () => {
  it('xoá sạch state', () => {
    useAuthStore.getState().setAuth(probeUser);

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false });
  });
});

describe('persist', () => {
  // Access token không còn đi qua store này — nó nằm trong cookie httpOnly do backend
  // đặt, ngoài tầm với của JS nên không có gì để lộ vào localStorage.
  it('chỉ ghi user và isAuthenticated vào localStorage', () => {
    useAuthStore.getState().setAuth(probeUser);

    const persisted = JSON.parse(localStorage.getItem('fcp-auth') ?? '{}');
    expect(persisted.state).toMatchObject({ user: probeUser, isAuthenticated: true });
    expect(persisted.state).not.toHaveProperty('accessToken');
  });
});
