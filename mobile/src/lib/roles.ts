import type { Role } from '@fcp/shared';

/**
 * Vai trò được vào khu quản lý. Thanh tab và cổng của từng màn hình phải đọc chung
 * một danh sách, nếu không sẽ có ngày tab hiện ra mà bấm vào lại bị từ chối.
 */
export const MANAGEMENT_ROLES: Role[] = ['field_owner', 'team_manager', 'admin'];

export const canManage = (roles: Role[] | undefined) =>
  !!roles?.some((role) => MANAGEMENT_ROLES.includes(role));

/**
 * Quản trị viên nền tảng đứng ngoài chat: họ xử lý khiếu nại bằng công cụ quản trị, và một
 * kênh riêng với họ trong app là kênh không ai kiểm được. Backend chặn ở cả REST lẫn lúc bắt
 * tay WebSocket, nên tab chat cũng phải biến mất thay vì dẫn tới một màn hình bị từ chối.
 */
export const canChat = (roles: Role[] | undefined) => !!roles && !roles.includes('admin');
