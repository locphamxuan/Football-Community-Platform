import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * jsdom không có `PointerEvent`, còn Base UI thì dựng `new ownerWindow(el).PointerEvent(...)`
 * ngay trong handler click của Switch. Thiếu nó, mọi test bấm công tắc đều ném
 * "PointerEvent is not a constructor" — và lỗi nổ ngoài stack của test nên rất khó lần ra:
 * `onCheckedChange` chỉ đơn giản là không bao giờ chạy.
 */
if (typeof window !== 'undefined' && !window.PointerEvent) {
  window.PointerEvent = class extends MouseEvent {} as unknown as typeof window.PointerEvent;
}

afterEach(cleanup);
