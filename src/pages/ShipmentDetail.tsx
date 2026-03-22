import { useParams, Link } from 'react-router-dom';
import { FileText, MapPin, Phone, User, Truck as TruckIcon } from 'lucide-react';
import { PageHeader, EmptyState, StatusBadge, WeighbridgeInput } from '@/components';
import { useShipmentStore, useStopStore } from '@/stores';

export function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const shipment = useShipmentStore((s) => s.shipments.find((sh) => sh.id === id));
  const stops = useStopStore((s) => s.stops.filter((st) => st.shipmentId === id));

  if (!shipment) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Shipment"
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Shipments', href: '/shipments' },
            { label: id ?? 'Unknown' },
          ]}
        />
        <EmptyState
          title="Shipment Not Found"
          description={`No shipment found with ID ${id}`}
          icon={FileText}
          action={
            <Link to="/shipments" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
              Back to Shipments
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={shipment.id}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Shipments', href: '/shipments' },
          { label: shipment.id },
        ]}
        status={shipment.status}
        actions={
          <div className="flex gap-2">
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50">
              Edit
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
              Update Status
            </button>
          </div>
        }
      />

      {/* Transport Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-4">
          <h3 className="text-base font-semibold text-text-primary">Transport Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Transporter</p>
              <p className="text-sm font-medium text-text-primary">{shipment.transporterName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">GST</p>
              <p className="text-sm font-mono text-text-primary">{shipment.transporterGst}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Vehicle</p>
              <p className="text-sm font-medium text-text-primary">{shipment.vehicleRegistration}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Vehicle Type</p>
              <p className="text-sm text-text-primary">{shipment.vehicleType}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Mode</p>
              <p className="text-sm capitalize text-text-primary">
                {shipment.transportMode.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Value</p>
              <p className="text-sm font-semibold text-text-primary">₹{shipment.shipmentValue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-4">
          <h3 className="text-base font-semibold text-text-primary">Driver Information</h3>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{shipment.driverName}</p>
              <div className="flex items-center gap-1 text-sm text-text-muted">
                <Phone className="h-3.5 w-3.5" />
                {shipment.driverPhone}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Link
              to={`/loads/${shipment.loadId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-100"
            >
              <TruckIcon className="h-3.5 w-3.5" />
              Load: {shipment.loadId}
            </Link>
          </div>
        </div>
      </div>

      {/* Stops */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Stops</h3>
        {stops.length === 0 ? (
          <EmptyState title="No Stops" description="No stops defined for this shipment" icon={MapPin} />
        ) : (
          <div className="space-y-4">
            {stops
              .sort((a, b) => a.sequence - b.sequence)
              .map((stop, index) => (
                <div key={stop.id} className="relative">
                  {index < stops.length - 1 && (
                    <div className="absolute left-5 top-12 h-[calc(100%)] w-0.5 bg-gray-200" />
                  )}
                  <div className="flex gap-4">
                    <div
                      className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                        stop.status === 'completed'
                          ? 'bg-success-100 text-success'
                          : stop.status === 'pending'
                          ? 'bg-warning-50 text-warning'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex-1 rounded-lg border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                            Stop {stop.sequence} — {stop.type}
                          </span>
                          <StatusBadge status={stop.status} />
                        </div>
                        {stop.completedAt && (
                          <span className="text-xs text-text-muted">
                            {new Date(stop.completedAt).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-text-primary">{stop.location.name}</p>
                      <p className="text-sm text-text-muted">{stop.location.address}</p>

                      {/* Planned items */}
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Planned</p>
                        <div className="flex flex-wrap gap-2">
                          {stop.plannedItems.map((item, i) => (
                            <span key={i} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                              {item.material}: {item.qty.toLocaleString()} {item.unit}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actual items if completed */}
                      {stop.actualItems.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Actual</p>
                          <div className="flex flex-wrap gap-2">
                            {stop.actualItems.map((item, i) => (
                              <span key={i} className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-600">
                                {item.material}: {item.qty.toLocaleString()} {item.unit}
                                {item.invoiceNumber ? ` (${item.invoiceNumber})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Weighbridge data */}
                      {stop.netWeight != null && stop.netWeight > 0 && (
                        <div className="mt-3">
                          <WeighbridgeInput
                            tareWeight={stop.tareWeight ?? 0}
                            grossWeight={stop.grossWeight ?? 0}
                            onChange={() => {}}
                            readOnly
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
