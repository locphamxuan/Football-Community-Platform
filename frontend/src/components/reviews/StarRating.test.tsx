import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import StarRating from './StarRating';

describe('StarRating', () => {
  it('gắn nhãn accessibility đúng số sao', () => {
    const { getByLabelText } = render(<StarRating value={4} />);
    expect(getByLabelText('4 trên 5 sao')).toBeInTheDocument();
  });

  it('tô màu đúng số sao đã đạt, còn lại để mờ', () => {
    const { container } = render(<StarRating value={3} />);
    const stars = container.querySelectorAll('svg');
    expect(stars).toHaveLength(5);
    expect(stars[0].getAttribute('class')).toContain('fill-amber-400');
    expect(stars[2].getAttribute('class')).toContain('fill-amber-400');
    expect(stars[3].getAttribute('class')).not.toContain('fill-amber-400');
  });
});
