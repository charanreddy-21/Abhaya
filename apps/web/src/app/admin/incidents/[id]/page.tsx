import { AdminIncidentDetail } from '@/components/domain/admin-incident-detail';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function AdminIncidentPage({ params }: { params: { id: string } }) {
  return (
    <AuthGuard requireAdmin>
      <AdminIncidentDetail incidentId={params.id} />
    </AuthGuard>
  );
}
