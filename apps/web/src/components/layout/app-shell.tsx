'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { WifiOff } from 'lucide-react';
import { BottomNav } from './bottom-nav';
import { SideNav } from './side-nav';
import { CursorGlow } from '@/components/ui/cursor-glow';
import { useOnlineStatus } from '@/lib/hooks';

// Routes where shell nav is hidden (auth pages, full-screen flows)
const SHELL_HIDDEN_PATHS = ['/auth/login', '/auth/register'];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOnline = useOnlineStatus();
  const hideShell = SHELL_HIDDEN_PATHS.some((p) => pathname.startsWith(p));

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <>
      <CursorGlow />
      {!isOnline && (
        <div className="offline-banner" role="alert">
          <WifiOff size={15} />
          You are offline. Abhaya will continue working and retry when connected.
        </div>
      )}
      <div className="shell-root">
        <SideNav />
        <main className="shell-main">
          {children}
        </main>
        <BottomNav />
      </div>
    </>
  );
}
