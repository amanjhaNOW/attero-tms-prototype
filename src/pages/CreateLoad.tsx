import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createLoadFromPRs, createEmptyLoad } from '@/lib/createLoadHelper';

/**
 * CreateLoad is now a thin redirect.
 * - /loads/create?prs=REQ-001,REQ-002 → creates load with those PRs → workspace
 * - /loads/create → creates empty load → workspace
 */
export function CreateLoad() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const prIdsParam = searchParams.get('prs');

    let loadId: string;
    if (prIdsParam) {
      const prIds = prIdsParam.split(',').filter(Boolean);
      loadId = createLoadFromPRs(prIds);
    } else {
      loadId = createEmptyLoad();
    }

    navigate(`/loads/${loadId}`, { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-text-muted">Creating load...</p>
    </div>
  );
}
