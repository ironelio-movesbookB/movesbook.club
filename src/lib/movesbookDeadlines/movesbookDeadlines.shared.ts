/** Browser-safe constants and types of the Movesbook Archive of Deadlines. */

/** Product sectors shown in the Typology column (and as the archive buttons). */
export const MOVESBOOK_TYPOLOGIES = {
  A: 'Subscription Desk',
  B: 'Subscription Mobile',
  C: 'Optional modules',
  D: 'New members slots',
  E: 'Accounts',
  F: 'Identification cards',
  G: 'Hardware',
} as const;
export type MovesbookTypology = keyof typeof MOVESBOOK_TYPOLOGIES;

export function isMovesbookTypology(value: unknown): value is MovesbookTypology {
  return typeof value === 'string' && value in MOVESBOOK_TYPOLOGIES;
}

export const DEADLINE_PAY_MODES = ['bank transfer', 'cash', 'card', 'paypal', 'stripe', 'other'] as const;

export type MovesbookDeadlineRow = {
  id: string;
  userId: string;
  fullName: string;
  username: string;
  userType: string;
  typology: MovesbookTypology;
  typologyLabel: string;
  detail: string;
  versionName: string;
  paymentModality: string | null;
  deadlineNo: number;
  deadlinesTotal: number;
  amountEur: number;
  paidEur: number;
  restEur: number;
  dueDate: string;
  createdAt: string;
  paidAt: string | null;
  payMode: string | null;
  operator: string | null;
  notes: string;
  overdue: boolean;
};
