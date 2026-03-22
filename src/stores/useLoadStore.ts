import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Load } from '@/types';
import { mockLoads } from '@/data';

interface LoadState {
  loads: Load[];
  addLoad: (load: Load) => void;
  updateLoad: (id: string, updates: Partial<Load>) => void;
  deleteLoad: (id: string) => void;
  getLoadById: (id: string) => Load | undefined;
}

export const useLoadStore = create<LoadState>()(
  persist(
    (set, get) => ({
      loads: mockLoads,
      addLoad: (load) =>
        set((state) => ({ loads: [...state.loads, load] })),
      updateLoad: (id, updates) =>
        set((state) => ({
          loads: state.loads.map((l) =>
            l.id === id ? { ...l, ...updates } : l
          ),
        })),
      deleteLoad: (id) =>
        set((state) => ({
          loads: state.loads.filter((l) => l.id !== id),
        })),
      getLoadById: (id) => get().loads.find((l) => l.id === id),
    }),
    { name: 'attero-tms-loads-v1' }
  )
);
