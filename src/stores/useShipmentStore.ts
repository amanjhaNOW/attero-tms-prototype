import { create } from 'zustand';
import type { Shipment } from '@/types';
import { mockShipments } from '@/data';

interface ShipmentState {
  shipments: Shipment[];
  addShipment: (shipment: Shipment) => void;
  updateShipment: (id: string, updates: Partial<Shipment>) => void;
  deleteShipment: (id: string) => void;
  getShipmentById: (id: string) => Shipment | undefined;
}

export const useShipmentStore = create<ShipmentState>((set, get) => ({
  shipments: mockShipments,
  addShipment: (shipment) =>
    set((state) => ({ shipments: [...state.shipments, shipment] })),
  updateShipment: (id, updates) =>
    set((state) => ({
      shipments: state.shipments.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),
  deleteShipment: (id) =>
    set((state) => ({
      shipments: state.shipments.filter((s) => s.id !== id),
    })),
  getShipmentById: (id) => get().shipments.find((s) => s.id === id),
}));
