export type PromocodeApplyRow = {
  id: number;
  promocodeId: number | null;
  created: string | null;
  receiverEmail: string | null;
  receiverId: number | null;
  senderId: number | null;
  senderEmail: string | null;
  registrationDate: string | null;
  isRegistered: string | number | null;
  senderCredit: string | null;
  receiverCredit: string | null;
  receiverVersion: string | null;
  secondarySenderUsername: string | null;
  secondarySenderCredit: string | null;
  newReceiver: string | null;
  sender: LegacyUserSnippet | null;
  receiver: LegacyUserSnippet | null;
  secondarySender: LegacyUserSnippet | null;
  existReceiverMatch: boolean;
  promocodeCode?: string | null;
  promocodeValidTo?: string | null;
  flagImage?: string | null;
  receiverCountryCode?: string | null;
  receiverCountryName?: string | null;
  senderFlagImage?: string | null;
  senderCountryCode?: string | null;
  senderCountryName?: string | null;
  secondaryFlagImage?: string | null;
  secondaryCountryCode?: string | null;
  secondaryCountryName?: string | null;
  inviteMode?: string | null;
  inviteExpiresAt?: string | null;
};

export type LegacyUserSnippet = {
  id: number;
  username: string | null;
  email: string | null;
  created: string | null;
  countryId: number | null;
  image: string | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  subscriptionSettingId: number | null;
  firstname: string | null;
  /** Legacy users.credits balance when the column exists. */
  credits?: number | null;
  roleId?: number | null;
  /** Club / team / group logo when this account is an entity. */
  logoUrl?: string | null;
};

export type PromocodeSettingRow = {
  id: number;
  code: string | null;
  createrId: number | null;
  validFrom: string | null;
  validTo: string | null;
  enable: string | null;
  usableBy: string | null;
  versionId: string | null;
  discount: string | null;
  enableExtension: string | null;
  subscriptionExtends: string | null;
  managementSection: string | null;
  socialOptions: string | null;
  enableFreeAccounts: string | null;
  basicVersion: string | null;
  premiumVersion: string | null;
  professionalVersion: string | null;
  languageId: number | null;
  helpHtmlPagesId: number | null;
  email: string | null;
  recipient: string | null;
  used: number | null;
  created: string | null;
  inviteCount: number;
  inviteEmails: string[];
  inviteEntries: PromocodeInviteEntry[];
  creator: LegacyUserSnippet | null;
  creatorFlagImage: string | null;
  creatorCountryCode: string | null;
  inviteFlagImage?: string | null;
  inviteCountryCode?: string | null;
  versionCount: number;
  lastInviteDate?: string | null;
  lastRegistrationDate?: string | null;
  allowChildPromocodes?: boolean;
  childPromoLimit?: number | null;
  childPromoUntil?: string | null;
  childVersionIds?: string | null;
  childDurationDays?: number | null;
  parentPromocodeId?: number | null;
};

export type PromocodeInviteEntry = {
  email: string;
  username: string | null;
  registered: boolean;
  /** Date the invite email/apply was created */
  inviteDate: string | null;
  registrationDate: string | null;
  subscriptionName: string | null;
};

export type PromocodeSettingFormData = {
  code: string;
  enable: boolean;
  toDay: string;
  toMonth: string;
  toYear: string;
  versionIds: number[];
  discount: string;
  usableBy: string;
  enableExtension: boolean;
  subscriptionExtends: string;
  managementSection: string;
  socialOptions: string[] | Record<string, unknown>;
  enableFreeAccounts: boolean;
  basicVersion: string;
  premiumVersion: string;
  professionalVersion: string;
  helpHtmlPagesId: number | null;
  languageId: number | null;
  email: string;
  recipient: string;
  allowChildPromocodes?: boolean;
  childPromoLimit?: string;
  childPromoUntil?: string;
  childVersionIds?: number[];
  childDurationDays?: string;
  parentPromocodeId?: number | null;
};

export type PromocodeListFilters = {
  search?: string;
  orderBy?: string;
  registeredOnly?: boolean;
  promocodeId?: number;
  usableBy?: string;
  versionId?: number;
  available?: 'current' | 'expired';
  /** Movesbook staff-created vs user-created promocodes. */
  creatorSource?: 'movesbook' | 'other';
  senderUsername?: string;
  secondaryUsername?: string;
  recipientUsername?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type PromocodeMeta = {
  subscriptions: { id: number; name: string }[];
  helpHtmlPages: { id: number; title: string }[];
  languages: { id: number; name: string }[];
};

export type PromocodeUserRow = {
  legacyUserId: number;
  username: string;
  wholeName: string;
  country: string | null;
  countryCode: string | null;
  flagImage: string | null;
  userType: string;
  version: string | null;
  expiration: string | null;
  firstPromocode: string | null;
  promocodesGenerated: number;
  creditsEarned: number;
  creditsUsed: number;
  creditsRemain: number;
  lastInviteDate: string | null;
  daysSinceLastInvite: number | null;
  lastRegistrationDate: string | null;
  daysSinceLastRegistration: number | null;
  email?: string | null;
  image?: string | null;
  logoUrl?: string | null;
  roleId?: number | null;
};
