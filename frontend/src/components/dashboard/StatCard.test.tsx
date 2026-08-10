import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('hiển thị nhãn và con số', () => {
    render(<StatCard icon={null} label="Doanh thu thuê bao" value="12,5 tr" />);
    expect(screen.getByText('Doanh thu thuê bao')).toBeInTheDocument();
    expect(screen.getByText('12,5 tr')).toBeInTheDocument();
  });

  it('hiện chú thích khi có hint', () => {
    render(<StatCard icon={null} label="Sân" value="3" hint="2 đang hoạt động" />);
    expect(screen.getByText('2 đang hoạt động')).toBeInTheDocument();
  });

  it('mức tăng hiện dấu ▲ và phần trăm dương', () => {
    render(<StatCard icon={null} label="Tháng này" value="5 tr" delta={12} />);
    expect(screen.getByText(/▲ 12%/)).toBeInTheDocument();
  });

  it('mức giảm hiện dấu ▼ với trị tuyệt đối', () => {
    render(<StatCard icon={null} label="Tháng này" value="5 tr" delta={-8} />);
    expect(screen.getByText(/▼ 8%/)).toBeInTheDocument();
  });

  it('không hiện gì khi delta là null', () => {
    render(<StatCard icon={null} label="Tháng này" value="5 tr" delta={null} />);
    expect(screen.queryByText(/[▲▼]/)).not.toBeInTheDocument();
  });

  it('delta bằng 0 hiện dấu gạch ngang, không phải mũi tên', () => {
    render(<StatCard icon={null} label="Tháng này" value="5 tr" delta={0} />);
    expect(screen.getByText(/— 0%/)).toBeInTheDocument();
  });
});
