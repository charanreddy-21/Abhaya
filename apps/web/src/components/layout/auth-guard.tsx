'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = false }: Props) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="auth-guard-loading">
        <Loader2 size={28} className="spin" style={{ color: 'var(--forest)' }} />
        <p>Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="auth-guard-forbidden">
        <div className="auth-guard-icon">
          <ShieldAlert size={36} />
        </div>
        <h2>Admin access required</h2>
        <p>This section is restricted to admin accounts.</p>
        <Button variant="secondary" onClick={() => router.push('/')}>
          Go home
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
