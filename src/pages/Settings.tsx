import { Settings as SettingsIcon } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings' }]}
      />
      <EmptyState
        title="General Settings"
        description="Application configuration and preferences. Coming soon."
        icon={SettingsIcon}
      />
    </div>
  );
}
