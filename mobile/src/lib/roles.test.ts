import { canManage } from './roles';

describe('canManage', () => {
  it('người chơi thuần không có khu quản lý', () => {
    expect(canManage(['user'])).toBe(false);
  });

  it('chủ sân, quản lý đội và quản trị viên đều vào được', () => {
    expect(canManage(['user', 'field_owner'])).toBe(true);
    expect(canManage(['team_manager'])).toBe(true);
    expect(canManage(['admin'])).toBe(true);
  });

  it('chưa đăng nhập thì chưa có vai trò nào', () => {
    expect(canManage(undefined)).toBe(false);
  });
});
