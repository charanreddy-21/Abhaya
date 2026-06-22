import { EvidenceVaultView } from '@/components/domain/evidence-vault';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function EvidencePage() {
  return (
    <AuthGuard>
      <EvidenceVaultView />
    </AuthGuard>
  );
}
