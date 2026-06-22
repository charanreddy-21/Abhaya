import { AdminCommandCenter } from '@/components/domain/admin-command-center';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function AdminPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminCommandCenter />
    </AuthGuard>
  );
}
