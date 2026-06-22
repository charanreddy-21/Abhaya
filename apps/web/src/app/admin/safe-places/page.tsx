import { AdminSafePlacesView } from '@/components/domain/admin-safe-places';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function AdminSafePlacesPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminSafePlacesView />
    </AuthGuard>
  );
}
