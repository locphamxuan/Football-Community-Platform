import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthlyBarChart from './MonthlyBarChart';

const data = [
  { label: 'T6', value: 1_000_000 },
  { label: 'T7', value: 3_000_000 },
  { label: 'T8', value: 2_000_000 },
];

const format = (n: number) => `${n / 1_000_000} tr`;

describe('MonthlyBarChart', () => {
  it('báo rõ khi chưa có dữ liệu', () => {
    render(<MonthlyBarChart data={[]} format={format} seriesLabel="Doanh thu" />);
    expect(screen.getByText('Chưa có dữ liệu.')).toBeInTheDocument();
  });

  it('vẽ nhãn trục cho từng tháng', () => {
    render(<MonthlyBarChart data={data} format={format} seriesLabel="Doanh thu" />);
    for (const d of data) {
      expect(screen.getAllByText(d.label).length).toBeGreaterThan(0);
    }
  });

  it('kèm bảng dữ liệu tương đương cho trình đọc màn hình', () => {
    render(<MonthlyBarChart data={data} format={format} seriesLabel="Doanh thu" />);
    const table = screen.getByRole('table', { name: /Doanh thu theo tháng/i });
    expect(table).toBeInTheDocument();
    // Mỗi tháng một hàng, giá trị đã định dạng
    expect(screen.getByRole('cell', { name: '3 tr' })).toBeInTheDocument();
  });

  it('chart mô tả được bằng bảng dữ liệu qua aria-describedby', () => {
    render(<MonthlyBarChart data={data} format={format} seriesLabel="Doanh thu" />);
    const chart = screen.getByRole('img');
    const describedBy = chart.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.tagName).toBe('TABLE');
  });

  it('không vỡ khi mọi giá trị bằng 0', () => {
    const zeros = [
      { label: 'T7', value: 0 },
      { label: 'T8', value: 0 },
    ];
    render(<MonthlyBarChart data={zeros} format={format} seriesLabel="Doanh thu" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
