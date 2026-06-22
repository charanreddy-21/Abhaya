import { SettingsView } from '@/components/domain/settings-view';
import { AuthGuard } from '@/components/layout/auth-guard';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsView />
    </AuthGuard>
  );
}
