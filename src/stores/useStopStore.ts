import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Stop } from '@/types';
import { mockStops } from '@/data';

interface StopState {
  stops: Stop[];
  addStop: (stop: Stop) => void;
  updateStop: (id: string, updates: Partial<Stop>) => void;
  deleteStop: (id: string) => void;
  getStopById: (id: string) => Stop | undefined;
  getStopsByShipment: (shipmentId: string) => Stop[];
}

export const useStopStore = create<StopState>()(
  persist(
    (set, get) => ({
      stops: mockStops,
      addStop: (stop) =>
        set((state) => ({ stops: [...state.stops, stop] })),
      updateStop: (id, updates) =>
        set((state) => ({
          stops: state.stops.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      deleteStop: (id) =>
        set((state) => ({
          stops: state.stops.filter((s) => s.id !== id),
        })),
      getStopById: (id) => get().stops.find((s) => s.id === id),
      getStopsByShipment: (shipmentId) =>
        get().stops.filter((s) => s.shipmentId === shipmentId),
    }),
    { name: 'attero-tms-stops-v1' }
  )
);
