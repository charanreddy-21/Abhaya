import { AdminAuditLogView } from '@/components/domain/admin-audit-log';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function AdminAuditPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminAuditLogView />
    </AuthGuard>
  );
}
