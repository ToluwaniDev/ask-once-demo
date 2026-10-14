export type Role = 'hcsw' | 'nurse' | 'support';
export type StaffRole = Role | 'nic';
export type Need = 'toilet' | 'drink' | 'pain' | 'comfort' | 'move' | 'talk' | 'jug' | 'spill';
export type Status = 'open' | 'accepted' | 'arrived' | 'done' | 'cancelled';
export type Level = 1 | 2 | 3;

export interface BedSettings {
  fallsRisk: boolean;
  largeText: boolean;
  readAloud: boolean;
}

export interface CareRequest {
  id: string;
  bed: string;
  need: Need;
  role: Role;
  status: Status;
  level: Level;
  fallsRisk: boolean;
  createdAt: number;
  acceptedAt?: number;
  arrivedAt?: number;
  doneAt?: number;
  cancelledAt?: number;
  acceptedBy?: string;
}

export interface RequestEvent {
  requestId: string;
  type: 'created' | 'escalated' | 'accepted' | 'arrived' | 'done' | 'cancelled';
  at: number;
  by?: string;
  detail?: string;
}
