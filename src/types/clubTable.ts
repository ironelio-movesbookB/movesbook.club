import React from "react";

export type Member = {
  id?: string;
  /** Member/user id for same-member multi-deadline pay validation */
  userId?: string;

  // selection
  checked?: boolean;
  /** Club member user id (for same-member multi-pay validation). */
  memberId?: string;

  // member list
  surname?: string;
  name?: string;
  username?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  dateOfBirthDisplay?: string;
  memberType?: string;
  Localcity?: string;
  localCity?: string;
  phone?: string;
  insertDate?: Date | string;
  /** Display-ready insert date (e.g. DD/MM/YYYY) when insertDate is kept as ISO for filters. */
  insertDateDisplay?: string;
  /** Parents archive — degree of kinship. */
  kinship?: string;
  /** Parents archive — linked athlete/member display name. */
  member?: string;
  memberLabel?: string;
  expirationDate?: Date | string;
  membershipEndDate?: Date | string;
  /** ClubMember join-table id (for remove from club). */
  clubMemberId?: string;

  // membership
  image?: string;
  typology?: string;
  course?: string;
  /** Primary sport from member profile (for Athletes filter). */
  sport?: string;
  /** Group of training id/label from Other details. */
  groupTrained?: string;
  groupTrainedId?: string;
  dateStart?: Date | string;
  dateEnd?: Date | string;
  membershipEnd?: Date | string;
  installments?: number;
  value?: number;
  status?: string;
  paid?: number;

  // subscription
  installment?: number;
  contract?: string;
  vendor?: string;
  area?: string;
  // deadline
  debt?: number;
  rest?: number;
  payed?: number;
  description?: string;
  operator?: string;
  /** Operator id behind `operator` — needed to preselect the operator when editing a row. */
  operatorId?: string;
  /** Club staff type when row comes from club_staff (coadmin/operator/collaborator). */
  staffType?: string | null;
  /** Club staff employment area / role when row comes from club_staff. */
  staffRole?: string | null;
  /** Parent procedure record id (cash movement drill-down). */
  procedureRecordId?: string;
  procedureType?: string;
  /** Position of this deadline inside its record, e.g. "2 of 3". */
  deadlineNo?: string;
  /** Creation timestamp of a deadline — shows the time next to the expire date. */
  expireAt?: string;

  // credit
  cost?: number;
  residual?: number;

  // movement
  payMod?: string;
  casual?: string;
  originalDebt?: number;
  residualDebt?: number;
  number?: number;
  category?: string;

  service?: string;
  /** Another receipt shares this row's document type + number. */
  isDuplicate?: boolean;
  /** Archive of Payments: stored as "To be verified" and not confirmed yet (grey row). */
  toBeVerified?: boolean;
  /**
   * Archive of Users A/B/C/D:
   * member | pending | not_member | archived
   */
  membershipStatus?: 'member' | 'pending' | 'not_member' | 'archived';
  /** Staff-only archive rows (no pending/not-member actions). */
  isStaffOnly?: boolean;
  /** Member account is a Coach (ID6) — status circle is half filled. */
  isCoach?: boolean;
  options?: React.ReactNode;
  edit?: React.ReactNode;
  delete?: React.ReactNode;

  // extended archive fields (legacy tables)
  outcome?: string;
  hour?: string;
  direction?: string;
  source?: string;
};

export type Column = {
  key: keyof Member;
  header: string | React.ReactNode;
  render?: (value: any, row: Member) => React.ReactNode; // ✅ FIXED
  /** When false, header shows no sort arrows and is not clickable. Default: true for data cols. */
  sortable?: boolean;
};