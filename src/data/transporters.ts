import type { Transporter, Vehicle } from '@/types';

export const mockTransporters: Transporter[] = [
  {
    id: 'TRN-001',
    name: 'India King Roadways',
    gstNumber: '05AAACI1234A1Z5',
    type: 'third_party',
    contact: '+91 9876000111',
  },
  {
    id: 'TRN-002',
    name: 'XYZ Carrier',
    gstNumber: '30AAAJA1548B1Z7',
    type: 'third_party',
    contact: '+91 9876000222',
  },
  {
    id: 'TRN-003',
    name: 'Attero Fleet',
    gstNumber: '05AAACR5678B1Z3',
    type: 'in_house',
    contact: '+91 9876000333',
  },
];

export const mockVehicles: Vehicle[] = [
  {
    id: 'VEH-001',
    registration: 'HR58D4082',
    type: '32FT 7 TON',
    capacityKg: 7000,
    transporterId: 'TRN-001',
  },
  {
    id: 'VEH-002',
    registration: 'RJ14GH5581',
    type: '20FT',
    capacityKg: 4000,
    transporterId: 'TRN-001',
  },
  {
    id: 'VEH-003',
    registration: 'HR55BA3766',
    type: '32FT',
    capacityKg: 7000,
    transporterId: 'TRN-002',
  },
  {
    id: 'VEH-004',
    registration: '22BH2122WW',
    type: 'Ace',
    capacityKg: 750,
    transporterId: 'TRN-003',
  },
  {
    id: 'VEH-005',
    registration: 'DL01AB1234',
    type: '17FT',
    capacityKg: 3000,
    transporterId: 'TRN-002',
  },
];
