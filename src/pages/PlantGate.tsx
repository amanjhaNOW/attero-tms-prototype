import { useState } from 'react';
import { Recycle, Search, Truck } from 'lucide-react';
import { SearchBar, StatusBadge, WeighbridgeInput, MaterialLineItems } from '@/components';

export function PlantGate() {
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [weighbridge, setWeighbridge] = useState({ tareWeight: 0, grossWeight: 0, netWeight: 0 });
  const [lineItems, setLineItems] = useState([
    { material: 'E-waste', qty: 0, unit: 'Kg', invoiceNumber: '', remarks: '' },
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Recycle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">Plant Gate</h1>
              <p className="text-xs text-text-muted">Attero Recycling Pvt Ltd, Haridwar</p>
            </div>
          </div>
          <StatusBadge status="pending" />
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {/* Vehicle Search */}
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <h3 className="mb-3 text-base font-semibold text-text-primary flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Vehicle Entry
          </h3>
          <SearchBar
            value={vehicleSearch}
            onChange={setVehicleSearch}
            placeholder="Enter vehicle registration number..."
          />
          {vehicleSearch && (
            <div className="mt-3 rounded-lg bg-primary-50 p-4">
              <p className="text-sm text-primary-700">
                <span className="font-semibold">Searching:</span> {vehicleSearch}
              </p>
              <p className="text-xs text-primary-600 mt-1">
                Vehicle lookup and shipment matching will be implemented in Slice 3.
              </p>
            </div>
          )}
        </div>

        {/* Weighbridge */}
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <h3 className="mb-4 text-base font-semibold text-text-primary">Weighbridge</h3>
          <WeighbridgeInput
            tareWeight={weighbridge.tareWeight}
            grossWeight={weighbridge.grossWeight}
            onChange={setWeighbridge}
          />
        </div>

        {/* Material Verification */}
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <h3 className="mb-4 text-base font-semibold text-text-primary">Material Verification</h3>
          <MaterialLineItems items={lineItems} onChange={setLineItems} />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button className="rounded-lg bg-success px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-success-600 transition-colors">
            Confirm Entry
          </button>
        </div>
      </div>
    </div>
  );
}
