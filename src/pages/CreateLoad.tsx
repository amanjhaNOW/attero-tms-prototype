import { useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Boxes, MapPin, Package } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components';
import { usePRStore, useLoadStore, useShipmentStore, useStopStore, useReferenceStore } from '@/stores';
import type { PickupRequest, Location } from '@/types';

export function CreateLoad() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prIdsParam = searchParams.get('prs');
  const allPRs = usePRStore((s) => s.pickupRequests);
  const updatePR = usePRStore((s) => s.updatePR);
  const addLoad = useLoadStore((s) => s.addLoad);
  const loads = useLoadStore((s) => s.loads);
  const addShipment = useShipmentStore((s) => s.addShipment);
  const shipments = useShipmentStore((s) => s.shipments);
  const addStop = useStopStore((s) => s.addStop);
  const stops = useStopStore((s) => s.stops);
  const locations = useReferenceStore((s) => s.locations);

  const plantAndWarehouseLocations = locations.filter(
    (l) => l.type === 'plant' || l.type === 'warehouse'
  );

  const [destinationId, setDestinationId] = useState('LOC-001');

  // Parse selected PR IDs from URL
  const selectedPRIds = useMemo(() => {
    if (!prIdsParam) return [];
    return prIdsParam.split(',').filter(Boolean);
  }, [prIdsParam]);

  const selectedPRs: PickupRequest[] = useMemo(() => {
    return selectedPRIds
      .map((id) => allPRs.find((pr) => pr.id === id))
      .filter((pr): pr is PickupRequest => pr !== undefined);
  }, [selectedPRIds, allPRs]);

  const totalQty = selectedPRs.reduce(
    (sum, pr) => sum + pr.materials.reduce((s, m) => s + m.plannedQty, 0),
    0
  );

  const destinationLoc = locations.find((l) => l.id === destinationId);

  const handleCreateLoad = useCallback(() => {
    if (selectedPRs.length === 0 || !destinationLoc) return;

    const loadNum = loads.length + 1;
    const loadId = `LOAD-${String(loadNum).padStart(3, '0')}`;
    const shipNum = shipments.length + 1;
    const shipId = `SHP-${String(shipNum).padStart(3, '0')}`;

    const dest: Location & { type: 'plant' | 'warehouse' } = {
      name: destinationLoc.name,
      state: destinationLoc.state,
      city: destinationLoc.city,
      pin: destinationLoc.pin,
      address: destinationLoc.address,
      type: destinationLoc.type as 'plant' | 'warehouse',
    };

    // For milk run: N PICKUP stops + 1 DELIVER stop
    // For direct (1 PR): 1 PICKUP + 1 DELIVER (same as before)
    const stopIdsForShipment: string[] = [];
    const pickupStopIds: string[] = [];
    let seq = 1;

    // Create PICKUP stops (one per PR)
    selectedPRs.forEach((pr) => {
      const pickupStopId = `STOP-${String(stops.length + seq).padStart(3, '0')}`;
      stopIdsForShipment.push(pickupStopId);
      pickupStopIds.push(pickupStopId);

      addStop({
        id: pickupStopId,
        shipmentId: shipId,
        sequence: seq,
        type: 'PICKUP',
        location: {
          name: pr.pickupLocation.name,
          state: pr.pickupLocation.state,
          city: pr.pickupLocation.city,
          pin: pr.pickupLocation.pin,
          address: pr.pickupLocation.address,
        },
        prId: pr.id,
        plannedItems: pr.materials.map((m) => ({
          material: m.type,
          qty: m.plannedQty,
          unit: m.unit,
        })),
        actualItems: [],
        totalActualQty: 0,
        status: 'pending',
      });

      seq += 1;
    });

    // Create 1 DELIVER stop at destination with ALL materials combined
    const deliverStopId = `STOP-${String(stops.length + seq).padStart(3, '0')}`;
    stopIdsForShipment.push(deliverStopId);

    const allPlannedItems = selectedPRs.flatMap((pr) =>
      pr.materials.map((m) => ({
        material: m.type,
        qty: m.plannedQty,
        unit: m.unit,
      }))
    );

    addStop({
      id: deliverStopId,
      shipmentId: shipId,
      sequence: seq,
      type: 'DELIVER',
      location: {
        name: dest.name,
        state: dest.state,
        city: dest.city,
        pin: dest.pin,
        address: dest.address,
      },
      prId: selectedPRs.length === 1 ? selectedPRs[0].id : '',
      plannedItems: allPlannedItems,
      actualItems: [],
      totalActualQty: 0,
      linkedStopId: pickupStopIds[0],
      status: 'pending',
    });

    // Create shipment
    addShipment({
      id: shipId,
      loadId: loadId,
      scheduledPickupDate: selectedPRs[0]?.tentativePickupDate ?? new Date().toISOString().split('T')[0],
      transportMode: 'carrier_third_party',
      transporterName: '',
      transporterGst: '',
      vehicleType: '',
      vehicleRegistration: '',
      driverName: '',
      driverPhone: '',
      stopIds: stopIdsForShipment,
      shipmentValue: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    // Create load
    const prIds = selectedPRs.map((pr) => pr.id);
    addLoad({
      id: loadId,
      prIds,
      shipmentIds: [shipId],
      destination: dest,
      totalPlannedQty: totalQty,
      totalActualQty: 0,
      documents: [],
      patternLabel: selectedPRs.length === 1 ? 'direct' : 'milk_run',
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    // Update PRs
    prIds.forEach((prId) => {
      const pr = allPRs.find((p) => p.id === prId);
      updatePR(prId, {
        status: 'planned',
        loadIds: [...(pr?.loadIds || []), loadId],
      });
    });

    navigate(`/loads/${loadId}`);
  }, [
    selectedPRs,
    destinationLoc,
    loads.length,
    shipments.length,
    stops.length,
    totalQty,
    allPRs,
    addLoad,
    addShipment,
    addStop,
    updatePR,
    navigate,
  ]);

  if (selectedPRs.length === 0) {
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
          title="No Pickup Requests Selected"
          description="Go to Pickup Requests, select one or more PRs, and click 'Create Load'."
          icon={Boxes}
          action={
            <Link
              to="/pickup-requests"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              Go to Pickup Requests
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Load"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Loads', href: '/loads' },
          { label: 'Create Load' },
        ]}
        actions={
          <button
            onClick={handleCreateLoad}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
          >
            Create Load
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-card p-4 text-center">
          <p className="text-sm text-text-muted">Selected PRs</p>
          <p className="text-2xl font-bold text-text-primary">{selectedPRs.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-card p-4 text-center">
          <p className="text-sm text-text-muted">Total Qty</p>
          <p className="text-2xl font-bold text-text-primary">
            {totalQty.toLocaleString()} Kg
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-card p-4 text-center">
          <p className="text-sm text-text-muted">Pattern</p>
          <p className="text-2xl font-bold text-primary capitalize">
            {selectedPRs.length === 1 ? 'Direct' : 'Milk Run'}
          </p>
        </div>
      </div>

      {/* Selected PR Cards */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">
          Selected Pickup Requests
        </h3>
        {selectedPRs.map((pr) => {
          const prQty = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
          return (
            <div
              key={pr.id}
              className="rounded-xl border border-gray-200 bg-card p-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/pickup-requests/${pr.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {pr.id}
                    </Link>
                    <span className="text-sm text-text-muted">
                      ({pr.sourceRequestId})
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    {pr.clientName}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-text-muted">
                    <MapPin className="h-3.5 w-3.5" />
                    {pr.pickupLocation.city}, {pr.pickupLocation.state}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-text-primary">
                    {prQty.toLocaleString()} Kg
                  </p>
                  <div className="flex flex-wrap justify-end gap-1 mt-1">
                    {pr.materials.map((m, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary"
                      >
                        <Package className="inline h-3 w-3 mr-0.5" />
                        {m.type} ({m.plannedQty} {m.unit})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Destination Picker */}
      <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-3">
        <h3 className="text-base font-semibold text-text-primary">Destination</h3>
        <select
          value={destinationId}
          onChange={(e) => setDestinationId(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {plantAndWarehouseLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.type}) — {l.city}, {l.state}
            </option>
          ))}
        </select>
        {destinationLoc && (
          <p className="text-sm text-text-muted">{destinationLoc.address}</p>
        )}
      </div>

      {/* Create button (bottom) */}
      <div className="flex justify-end">
        <button
          onClick={handleCreateLoad}
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
        >
          Create Load & Continue →
        </button>
      </div>
    </div>
  );
}
