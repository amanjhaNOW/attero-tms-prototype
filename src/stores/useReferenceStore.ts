import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Client, Transporter, Vehicle, LocationMaster } from '@/types';
import { mockClients, mockTransporters, mockVehicles, mockLocations } from '@/data';

interface ReferenceState {
  clients: Client[];
  transporters: Transporter[];
  vehicles: Vehicle[];
  locations: LocationMaster[];
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addTransporter: (transporter: Transporter) => void;
  updateTransporter: (id: string, updates: Partial<Transporter>) => void;
  deleteTransporter: (id: string) => void;
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  addLocation: (location: LocationMaster) => void;
  updateLocation: (id: string, updates: Partial<LocationMaster>) => void;
  deleteLocation: (id: string) => void;
}

export const useReferenceStore = create<ReferenceState>()(
  persist(
    (set) => ({
      clients: mockClients,
      transporters: mockTransporters,
      vehicles: mockVehicles,
      locations: mockLocations,

      addClient: (client) =>
        set((state) => ({ clients: [...state.clients, client] })),
      updateClient: (id, updates) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      deleteClient: (id) =>
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
        })),

      addTransporter: (transporter) =>
        set((state) => ({ transporters: [...state.transporters, transporter] })),
      updateTransporter: (id, updates) =>
        set((state) => ({
          transporters: state.transporters.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      deleteTransporter: (id) =>
        set((state) => ({
          transporters: state.transporters.filter((t) => t.id !== id),
        })),

      addVehicle: (vehicle) =>
        set((state) => ({ vehicles: [...state.vehicles, vehicle] })),
      updateVehicle: (id, updates) =>
        set((state) => ({
          vehicles: state.vehicles.map((v) =>
            v.id === id ? { ...v, ...updates } : v
          ),
        })),
      deleteVehicle: (id) =>
        set((state) => ({
          vehicles: state.vehicles.filter((v) => v.id !== id),
        })),

      addLocation: (location) =>
        set((state) => ({ locations: [...state.locations, location] })),
      updateLocation: (id, updates) =>
        set((state) => ({
          locations: state.locations.map((l) =>
            l.id === id ? { ...l, ...updates } : l
          ),
        })),
      deleteLocation: (id) =>
        set((state) => ({
          locations: state.locations.filter((l) => l.id !== id),
        })),
    }),
    { name: 'attero-tms-refs-v1' }
  )
);
