export interface Location {
  name: string;
  state: string;
  city: string;
  pin: string;
  address: string;
}

export interface MaterialItem {
  type: string;
  plannedQty: number;
  unit: string;
}

export interface PickupRequest {
  id: string;
  sourceRequestId: string;
  requestType: 'IPR' | 'PR';
  serviceType: 'point_to_point' | 'milk_run';
  clientName: string;
  pickupLocation: Location;
  deliveryLocation: Location;
  materials: MaterialItem[];
  tentativePickupDate: string;
  status: 'pending' | 'planned' | 'picked_up' | 'delivered' | 'closed' | 'cancelled';
  loadIds: string[];
  createdAt: string;
}

export interface TMSDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface Load {
  id: string;
  prIds: string[];
  shipmentIds: string[];
  destination: Location & { type: 'plant' | 'warehouse' };
  totalPlannedQty: number;
  totalActualQty: number;
  documents: TMSDocument[];
  patternLabel: 'direct' | 'milk_run' | 'multi_vehicle' | 'cross_dock' | 'cross_dock_milk_run' | 'warehouse_consolidation';
  parentLoadId?: string;
  status: 'draft' | 'partially_planned' | 'fully_planned' | 'in_execution' | 'completed';
  createdAt: string;
}

export interface StopItem {
  material: string;
  qty: number;
  unit: string;
  invoiceNumber?: string;
  remarks?: string;
}

export interface Stop {
  id: string;
  shipmentId: string;
  sequence: number;
  type: 'PICKUP' | 'DELIVER' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  location: Location;
  prId: string;
  plannedItems: StopItem[];
  actualItems: StopItem[];
  totalActualQty: number;
  tareWeight?: number;
  grossWeight?: number;
  netWeight?: number;
  linkedStopId?: string;
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: string;
}

export interface Shipment {
  id: string;
  loadId: string;
  scheduledPickupDate: string;
  transportMode: 'carrier_third_party' | 'fleet_own';
  transporterName: string;
  transporterGst: string;
  vehicleType: string;
  vehicleRegistration: string;
  driverName: string;
  driverPhone: string;
  stopIds: string[];
  parentShipmentId?: string;
  shipmentValue: number;
  status: 'draft' | 'planned' | 'in_transit' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  address: Location;
  contactPerson: string;
  phone: string;
  materialTypes: string[];
}

export interface Transporter {
  id: string;
  name: string;
  gstNumber: string;
  type: 'third_party' | 'in_house';
  contact: string;
}

export interface Vehicle {
  id: string;
  registration: string;
  type: string;
  capacityKg: number;
  transporterId: string;
}

export interface LocationMaster {
  id: string;
  name: string;
  type: 'plant' | 'warehouse' | 'client';
  state: string;
  city: string;
  pin: string;
  address: string;
}

// Column definition for DataTable
export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
}

// Tab definition
export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

// Filter chip
export interface FilterChip {
  key: string;
  label: string;
  value: string;
}
