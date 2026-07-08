'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useMounted from '@/hooks/useMounted';

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Tránh hydration mismatch — chỉ render icon sau khi mount
  const mounted = useMounted();

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Đổi giao diện sáng/tối" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="cursor-pointer"
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
