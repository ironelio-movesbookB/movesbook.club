export type SubscriptionUserType = 'athlete' | 'coach' | 'team' | 'group' | 'club';

export type SubscriptionNotifyChannel = 'mail' | 'network' | 'cellular' | 'facebook';

export type SubscriptionTier = 'trial' | 'base' | 'premium' | 'pro';

export type SubscriptionListRow = {
  id: number;
  listOrder: number;
  code: string;
  name: string;
  userType: SubscriptionUserType;
  days1: number;
  days2: number;
  price1: number;
  price2: number;
  credit1: number;
  credit2: number;
  credit3: number;
  credit4: number;
  inviteAthletes: number;
  inviteTeams: number;
  inviteGroups: number;
  inviteClubs: number;
  /** Coach / team / club only — companies the admin can create. */
  creatableCompanies: number;
  /** Coach / team / club only — users for the first subscription. */
  usersFirstSubscription: number;
  /** Coach / team / club only — users for renewal subscriptions. */
  usersRenewal: number;
  notifyChannels: SubscriptionNotifyChannel[];
  isDefault?: boolean;
  isTemplate?: boolean;
};

export type SubscriptionGeneralSettings = {
  code: string;
  name: string;
  senderRegisterCredit1: number;
  senderRegisterCredit2: number;
  receiverRegisterCredit1: number;
  receiverRegisterCredit2: number;
  maxDiscount: number;
  promocodeDurationDays: number;
  promocodeAssign: boolean;
  firstSubscriptionDays: number;
  firstSubscriptionPrice: number;
  firstSubscriptionPromoDiscount: number;
  renewalDays: number;
  renewalPrice: number;
  renewalPromoDiscount: number;
  tripleDurationDiscount: number;
  tripleDurationPrice: number;
  sloganByLang: Record<string, string>;
};

export type SubscriptionMembershipSetting = {
  limit: number;
  sharingEnabled: boolean;
};

export type SubscriptionEditSettings = {
  coachesLimit: number;
  coachTiers: Record<SubscriptionTier, boolean>;
  athletesLimit: number;
  athleteTiers: Record<SubscriptionTier, boolean>;
  /** Coach / team / club — free athlete accounts per athlete version tier (-1 = unlimited). */
  athleteTierLimits?: Record<SubscriptionTier, number>;
  /** Coach / team / club — limit and sharing with invited coaches. */
  coachSharing: SubscriptionMembershipSetting;
  /** Coach / team / club — max manageable users (synced to browse table). */
  creatableCompanies: number;
  usersAvailableFirstSubscription: number;
  usersAvailableRenewal: number;
  teams: SubscriptionMembershipSetting;
  groups: SubscriptionMembershipSetting;
  clubs: SubscriptionMembershipSetting;
  alertDaysBefore: number;
  alertDaysAfter: number;
  alertEveryDay: boolean;
  notifyMail: boolean;
  notifyNetwork: boolean;
  notifyCellular: boolean;
  notifyFacebook: boolean;
  inviteEndMode: 'own_subscription' | 'days_after_accept' | 'coach_subscription';
  inviteEndDays: number;
  invitedUserVersion: 'same' | 'next' | 'professional';
  expirationMessageEnabled: boolean;
  expirationDaysAfter: number;
  expirationDaysBefore: number;
  expirationMessageByLang: Record<string, string>;
  lastNewsByLang: Record<string, string>;
};

export type SubscriptionEditData = {
  id: number;
  listOrder: number;
  userType: SubscriptionUserType;
  general: SubscriptionGeneralSettings;
  settings: SubscriptionEditSettings;
};
