import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleGuard from './RoleGuard';
import useAuthStore from '@/stores/authStore';
import type { Role, User } from '@/types';

const signedInAs = (...roles: Role[]) =>
  useAuthStore.setState({
    user: { _id: 'u1', fullName: 'Probe', roles } as unknown as User,
    isAuthenticated: true,
  });

const signedOut = () => useAuthStore.setState({ user: null, isAuthenticated: false });

const ownerArea = (
  <RoleGuard
    allow={['field_owner', 'admin']}
    deniedTitle="Tài khoản chưa phải chủ sân"
    deniedDescription="Liên hệ ban quản trị để được nâng quyền."
  >
    <p>Số liệu sân</p>
  </RoleGuard>
);

beforeEach(() => {
  signedOut();
});

describe('RoleGuard', () => {
  it('chưa đăng nhập thì mời đăng nhập chứ không hiện nội dung', () => {
    render(ownerArea);

    expect(screen.getByText('Cần đăng nhập')).toBeInTheDocument();
    expect(screen.queryByText('Số liệu sân')).not.toBeInTheDocument();
  });

  it('sai vai trò thì nói rõ vì sao', () => {
    signedInAs('user');
    render(ownerArea);

    expect(screen.getByText('Tài khoản chưa phải chủ sân')).toBeInTheDocument();
    expect(screen.queryByText('Số liệu sân')).not.toBeInTheDocument();
  });

  it('có một trong các vai trò được phép là vào được', () => {
    signedInAs('user', 'field_owner');
    render(ownerArea);

    expect(screen.getByText('Số liệu sân')).toBeInTheDocument();
  });

  it('admin đi qua được mọi khu có tên nó trong danh sách', () => {
    signedInAs('admin');
    render(ownerArea);

    expect(screen.getByText('Số liệu sân')).toBeInTheDocument();
  });

  // Khu hồ sơ / thông báo / lịch đặt dùng dạng này: mọi vai trò đều vào được.
  it('bỏ trống allow thì chỉ cần đăng nhập', () => {
    signedInAs('user');
    render(
      <RoleGuard>
        <p>Hồ sơ của tôi</p>
      </RoleGuard>
    );

    expect(screen.getByText('Hồ sơ của tôi')).toBeInTheDocument();
  });

  it('bỏ trống allow vẫn chặn khách chưa đăng nhập', () => {
    render(
      <RoleGuard>
        <p>Hồ sơ của tôi</p>
      </RoleGuard>
    );

    expect(screen.getByText('Cần đăng nhập')).toBeInTheDocument();
    expect(screen.queryByText('Hồ sơ của tôi')).not.toBeInTheDocument();
  });
});
