import type { Need, Role, StaffRole } from './types';

// Which role each bedside button goes to. A real ward would edit this.
export const NEEDS: Record<Need, { label: string; role: Role }> = {
  toilet: { label: 'Toilet', role: 'hcsw' },
  drink: { label: 'Drink', role: 'hcsw' },
  comfort: { label: 'Comfort', role: 'hcsw' },
  move: { label: 'Help to move', role: 'hcsw' },
  pain: { label: 'Pain', role: 'nurse' },
  talk: { label: 'Talk to me', role: 'nurse' },
  jug: { label: 'Water jug', role: 'support' },
  spill: { label: 'Spill', role: 'support' },
};

export const ROLES: Record<StaffRole, string> = {
  hcsw: 'Healthcare support worker',
  nurse: 'Nurse',
  support: 'Housekeeping and catering',
  nic: 'Nurse in charge',
};

// Falls-risk patients asking for these skip straight to level 2.
export const URGENT_NEEDS: Need[] = ['toilet', 'move'];

// Seconds before an unaccepted request moves up a level (short for demos).
export const ESCALATION_SECONDS: [number, number] = [
  Number(process.env.ESCALATE_1_SECONDS ?? 45),
  Number(process.env.ESCALATE_2_SECONDS ?? 45),
];
