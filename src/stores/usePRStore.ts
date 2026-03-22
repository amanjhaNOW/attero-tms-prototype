import { create } from 'zustand';
import type { PickupRequest } from '@/types';
import { mockPickupRequests } from '@/data';

interface PRState {
  pickupRequests: PickupRequest[];
  addPR: (pr: PickupRequest) => void;
  updatePR: (id: string, updates: Partial<PickupRequest>) => void;
  deletePR: (id: string) => void;
  getPRById: (id: string) => PickupRequest | undefined;
}

export const usePRStore = create<PRState>((set, get) => ({
  pickupRequests: mockPickupRequests,
  addPR: (pr) =>
    set((state) => ({ pickupRequests: [...state.pickupRequests, pr] })),
  updatePR: (id, updates) =>
    set((state) => ({
      pickupRequests: state.pickupRequests.map((pr) =>
        pr.id === id ? { ...pr, ...updates } : pr
      ),
    })),
  deletePR: (id) =>
    set((state) => ({
      pickupRequests: state.pickupRequests.filter((pr) => pr.id !== id),
    })),
  getPRById: (id) => get().pickupRequests.find((pr) => pr.id === id),
}));
