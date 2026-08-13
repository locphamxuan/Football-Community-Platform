'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationPreferences from '@/components/notifications/NotificationPreferences';

export default function NotificationSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          nativeButton={false}
          className="mb-2 -ml-3 cursor-pointer"
          render={<Link href="/notifications" />}
        >
          <ArrowLeft className="size-4" />
          Về hộp thư
        </Button>
        <h1 className="text-2xl font-bold">Cài đặt thông báo</h1>
        <p className="mt-1 text-muted-foreground">
          Chọn việc gì đáng để làm phiền bạn.
        </p>
      </div>

      <NotificationPreferences />
    </div>
  );
}
