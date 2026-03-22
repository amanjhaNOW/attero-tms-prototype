import { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Send, XCircle } from 'lucide-react';
import { PageHeader, SearchBar, TabBar, DataTable, StatusBadge } from '@/components';
import { useShipmentStore, useStopStore, dispatchShipment, cancelShipment } from '@/stores';
import type { ColumnDef, TabItem, Shipment } from '@/types';

export function ShipmentList() {
  const shipments = useShipmentStore((s) => s.shipments);
  const stops = useStopStore((s) => s.stops);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const handleDispatch = useCallback(
    (e: React.MouseEvent, shipmentId: string) => {
      e.stopPropagation();
      dispatchShipment(shipmentId);
    },
    []
  );

  const handleCancel = useCallback(
    (e: React.MouseEvent, shipmentId: string) => {
      e.stopPropagation();
      cancelShipment(shipmentId);
    },
    []
  );

  const tabs: TabItem[] = useMemo(() => {
    const counts: Record<string, number> = { all: shipments.length };
    shipments.forEach((s) => {
      counts[s.status] = (counts[s.status] || 0) + 1;
    });
    return [
      { key: 'all', label: 'All', count: counts.all },
      { key: 'draft', label: 'Draft', count: counts.draft || 0 },
      { key: 'planned', label: 'Planned', count: counts.planned || 0 },
      { key: 'in_transit', label: 'In Transit', count: counts.in_transit || 0 },
      { key: 'completed', label: 'Completed', count: counts.completed || 0 },
      { key: 'cancelled', label: 'Cancelled', count: counts.cancelled || 0 },
    ];
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    let result = shipments;
    if (activeTab !== 'all') {
      result = result.filter((s) => s.status === activeTab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.transporterName.toLowerCase().includes(q) ||
          s.vehicleRegistration.toLowerCase().includes(q) ||
          s.driverName.toLowerCase().includes(q) ||
          s.loadId.toLowerCase().includes(q)
      );
    }
    return result;
  }, [shipments, activeTab, search]);

  const columns: ColumnDef<Shipment & Record<string, unknown>>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'Shipment ID',
        sortable: true,
        render: (_val, row) => {
          const sh = row as unknown as Shipment;
          return (
            <Link
              to={`/shipments/${sh.id}`}
              className="font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {sh.id}
            </Link>
          );
        },
      },
      {
        key: 'loadId',
        header: 'Load',
        sortable: true,
        render: (_val, row) => {
          const sh = row as unknown as Shipment;
          return (
            <Link
              to={`/loads/${sh.loadId}`}
              className="text-sm text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {sh.loadId}
            </Link>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (_val, row) => {
          const sh = row as unknown as Shipment;
          return <StatusBadge status={sh.status} />;
        },
      },
      { key: 'transporterName', header: 'Transporter', sortable: true },
      { key: 'vehicleRegistration', header: 'Vehicle' },
      { key: 'driverName', header: 'Driver' },
      {
        key: 'origin',
        header: 'Origin',
        render: (_val, row) => {
          const sh = row as unknown as Shipment;
          const shipStops = stops.filter((s) => s.shipmentId === sh.id);
          const pickup = shipStops.find((s) => s.type === 'PICKUP');
          return pickup ? (
            <span className="text-text-secondary">{pickup.location.city}</span>
          ) : (
            <span className="text-text-muted">—</span>
          );
        },
      },
      {
        key: 'destination',
        header: 'Destination',
        render: (_val, row) => {
          const sh = row as unknown as Shipment;
          const shipStops = stops.filter((s) => s.shipmentId === sh.id);
          const deliver = shipStops.find((s) => s.type === 'DELIVER');
          return deliver ? (
            <span className="text-text-secondary">{deliver.location.city}</span>
          ) : (
            <span className="text-text-muted">—</span>
          );
        },
      },
      {
        key: 'stopProgress',
        header: 'Stops',
        render: (_val, row) => {
          const sh = row as unknown as Shipment;
          const shipStops = stops.filter((s) => s.shipmentId === sh.id);
          const completed = shipStops.filter((s) => s.status === 'completed').length;
          return (
            <span className="text-text-muted">
              {completed}/{shipStops.length}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: '',
        width: 'w-28',
        render: (_val, row) => {
          const sh = row as unknown as Shipment;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {sh.status === 'planned' && (
                <button
                  onClick={(e) => handleDispatch(e, sh.id)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary-50 transition-colors"
                  title="Dispatch"
                >
                  <Send className="h-3 w-3" />
                  Dispatch
                </button>
              )}
              {(sh.status === 'draft' || sh.status === 'planned') && (
                <button
                  onClick={(e) => handleCancel(e, sh.id)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger-50 transition-colors"
                  title="Cancel"
                >
                  <XCircle className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [stops, handleDispatch, handleCancel]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shipments"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Shipments' }]}
      />

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by ID, transporter, vehicle, driver, load..."
        className="max-w-md"
      />

      <DataTable
        columns={columns}
        data={filteredShipments as (Shipment & Record<string, unknown>)[]}
        onRowClick={(row) =>
          navigate(`/shipments/${(row as unknown as Shipment).id}`)
        }
        pageSize={10}
      />
    </div>
  );
}
