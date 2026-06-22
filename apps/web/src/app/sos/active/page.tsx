import { ActiveSOSView } from '@/components/domain/active-sos';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function ActiveSOSPage() {
  return (
    <AuthGuard>
      <ActiveSOSView />
    </AuthGuard>
  );
}
