import { AdminUsersView } from '@/components/domain/admin-users';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function AdminUsersPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminUsersView />
    </AuthGuard>
  );
}
