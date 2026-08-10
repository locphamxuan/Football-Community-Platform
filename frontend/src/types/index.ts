/**
 * Hợp đồng API nằm ở shared/types.ts để mobile dùng chung — file này chỉ
 * tái xuất, nên mọi import `@/types` sẵn có vẫn chạy như cũ.
 */
export type * from '@fcp/shared';

import type { User } from '@fcp/shared';

// ── Auth ─────────────────────────────────────────────────────────────────────
// Trạng thái đăng nhập là chuyện của riêng web (zustand + localStorage),
// mobile lưu token bằng cách khác nên không để chung.
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}
