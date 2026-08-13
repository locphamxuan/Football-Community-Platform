import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';

/**
 * Dựng màn hình có dùng react-query trong test.
 *
 * Hai chỉnh sửa đều để dọn hẹn giờ, không phải để đi nhanh hơn:
 * - `notifyManager` chạy đồng bộ: mặc định nó gom thông báo đổi trạng thái rồi bắn qua
 *   `setTimeout(0)`, cái hẹn giờ đó nổ sau khi test đã xong nên cảnh báo act() hiện lên ở
 *   **test kế tiếp** — chạy riêng từng test thì sạch, chạy cả file mới thấy.
 * - `gcTime: 0`: cache mặc định sống 5 phút, để lại hẹn giờ treo và jest phải giết worker
 *   ("worker process has failed to exit gracefully").
 */
notifyManager.setScheduler((callback) => callback());

export const renderWithQuery = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};
