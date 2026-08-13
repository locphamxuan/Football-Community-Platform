import type { Role } from '@fcp/shared';

/**
 * Vai trò được vào khu quản lý. Thanh tab và cổng của từng màn hình phải đọc chung
 * một danh sách, nếu không sẽ có ngày tab hiện ra mà bấm vào lại bị từ chối.
 */
export const MANAGEMENT_ROLES: Role[] = ['field_owner', 'team_manager', 'admin'];

export const canManage = (roles: Role[] | undefined) =>
  !!roles?.some((role) => MANAGEMENT_ROLES.includes(role));
