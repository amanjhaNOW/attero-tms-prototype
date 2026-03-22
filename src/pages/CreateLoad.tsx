import { PageHeader, EmptyState } from '@/components';
import { Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CreateLoad() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Load"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Loads', href: '/loads' },
          { label: 'Create Load' },
        ]}
      />
      <EmptyState
        title="Load Builder"
        description="Select pickup requests and configure the load. Full implementation coming in Slice 1."
        icon={Boxes}
        action={
          <Link
            to="/loads"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Back to Loads
          </Link>
        }
      />
    </div>
  );
}
