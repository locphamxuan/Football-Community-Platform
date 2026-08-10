'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface MonthlyBarDatum {
  label: string;
  value: number;
  /** Dòng phụ hiện trong tooltip, ví dụ số lượt đặt của tháng đó. */
  secondary?: string;
}

interface MonthlyBarChartProps {
  data: MonthlyBarDatum[];
  /** Hàm định dạng giá trị (tiền, số lượt...). */
  format: (n: number) => string;
  /** Nhãn của chuỗi số liệu — chart chỉ có một chuỗi nên không cần legend. */
  seriesLabel: string;
  className?: string;
}

/**
 * Cột theo tháng, một chuỗi số liệu duy nhất.
 *
 * Một chuỗi nên không có legend (tiêu đề đã gọi tên nó), chỉ dán nhãn trực tiếp ở cột
 * cao nhất và cột cuối để không biến trục thành bảng số. Bảng dữ liệu ẩn đi kèm để
 * trình đọc màn hình và người không phân biệt được chiều cao cột vẫn đọc được.
 */
export default function MonthlyBarChart({ data, format, seriesLabel, className }: MonthlyBarChartProps) {
  const tableId = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 0);
  const maxIndex = data.findIndex((d) => d.value === max && max > 0);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  }

  return (
    <figure className={cn('space-y-3', className)}>
      <div className="flex h-52 items-end gap-2" role="img" aria-describedby={tableId}>
        {data.map((d, i) => {
          const heightPct = max > 0 ? Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0) : 0;
          const labelled = i === maxIndex || i === data.length - 1;
          return (
            <div
              key={d.label}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
            >
              {/* Nhãn trực tiếp chỉ ở cột cao nhất và cột cuối */}
              {labelled && d.value > 0 && (
                <span className="truncate text-center text-[11px] font-medium text-muted-foreground">
                  {format(d.value)}
                </span>
              )}
              <div
                className={cn(
                  'w-full rounded-t-[4px] bg-primary/80 transition-colors duration-200',
                  hovered === i && 'bg-primary'
                )}
                style={{ height: `${heightPct}%` }}
              />
              {hovered === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-[12rem] -translate-x-1/2 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                  <p className="font-medium">{d.label}</p>
                  <p className="text-muted-foreground">
                    {seriesLabel}: <span className="text-foreground">{format(d.value)}</span>
                  </p>
                  {d.secondary && <p className="text-muted-foreground">{d.secondary}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 border-t pt-2">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>

      {/* Bảng dữ liệu tương đương, ẩn về mặt thị giác */}
      <table id={tableId} className="sr-only">
        <caption>{seriesLabel} theo tháng</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
