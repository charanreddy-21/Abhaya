import { SOSHistoryView } from '@/components/domain/sos-history';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function SOSHistoryPage() {
  return (
    <AuthGuard>
      <SOSHistoryView />
    </AuthGuard>
  );
}
