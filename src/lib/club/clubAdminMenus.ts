import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  CircleSlash,
  ClipboardCheck,
  Clock,
  Contact2,
  CornerDownLeft,
  CornerDownRight,
  CreditCard,
  FileStack,
  FileText,
  FileWarning,
  FolderOpen,
  HelpCircle,
  Hourglass,
  Megaphone,
  Paperclip,
  Phone,
  Presentation,
  Receipt,
  Repeat2,
  Server,
  ShoppingBasket,
  ShoppingCart,
  Timer,
  User,
  UserCog,
  Users,
  Users2,
} from 'lucide-react';

export type ClubAdminInsertItem =
  | { kind: 'icon'; Icon: LucideIcon; label: string; path?: string }
  | { kind: 'affiliate'; label: string; path?: string }
  | { kind: 'assignAlert'; label: string; path?: string }
  | { kind: 'recordAlert'; label: string; path?: string };

export type ClubAdminArchiveItem =
  | { kind: 'icon'; Icon: LucideIcon; label: string; path: string }
  | { kind: 'affiliate'; label: string; path: string }
  | { kind: 'overview'; label: string }
  | { kind: 'group'; Icon: LucideIcon; label: string }
  | { kind: 'child'; label: string; path: string };

/** Same links as Club Admin sidebar → Insert a new item. */
export const CLUB_ADMIN_INSERT_NEW_ITEM_GROUPS: ClubAdminInsertItem[][] = [
  [
    { kind: 'icon', Icon: FileText, label: 'New user' },
    { kind: 'affiliate', label: 'New affiliate to the club', path: '/clubMembers/memberList' },
  ],
  [
    { kind: 'icon', Icon: Contact2, label: 'New subscription to the Club' },
    { kind: 'icon', Icon: Timer, label: 'Quick renew subscription' },
    { kind: 'icon', Icon: CheckCircle, label: 'Payment of deadlines', path: '/clubs/archive_deadlines' },
  ],
  [
    { kind: 'icon', Icon: ShoppingCart, label: 'Sell products', path: '/ArchiveSeles/product_sale_list' },
    {
      kind: 'icon',
      Icon: ShoppingBasket,
      label: 'Insert a movement of selling service',
      path: '/clubs/new_moment_cash',
    },
    { kind: 'icon', Icon: Hourglass, label: 'Payment other deadlines', path: '/clubs/archive_service_list' },
  ],
  [
    { kind: 'icon', Icon: Hourglass, label: 'Add a new credit', path: '/clubMembers/pay_member_employee' },
    { kind: 'icon', Icon: Hourglass, label: 'Insert a new debit', path: '/clubMembers/debt_member' },
  ],
  [
    { kind: 'icon', Icon: ArrowUpRight, label: 'Payment expenses', path: '/clubs/new_expense' },
    { kind: 'icon', Icon: ArrowUpRight, label: 'Pay a member or an employee', path: '/clubMembers/pay_member_employee' },
  ],
  [
    { kind: 'icon', Icon: CreditCard, label: 'Card to a member' },
    { kind: 'icon', Icon: Contact2, label: 'Card for operator' },
    { kind: 'icon', Icon: ArrowLeftRight, label: 'Card replacement' },
  ],
  [
    { kind: 'icon', Icon: Paperclip, label: 'Insert a Reservation' },
    { kind: 'icon', Icon: Phone, label: 'Marketing contact' },
    { kind: 'icon', Icon: Calendar, label: 'Insert event in Agenda' },
  ],
  [
    { kind: 'assignAlert', label: 'Assign alert to an user' },
    { kind: 'icon', Icon: Clock, label: 'Track an access manually' },
    { kind: 'recordAlert', label: 'Record an alert to an user' },
    { kind: 'icon', Icon: CircleSlash, label: 'Quick door block' },
  ],
  [
    { kind: 'icon', Icon: Users, label: 'New Employee/Operator' },
    { kind: 'icon', Icon: Presentation, label: 'New Poll' },
    { kind: 'icon', Icon: Megaphone, label: 'New Advertising campaign' },
  ],
];

/** Same links as Club Admin sidebar → Archives. */
export const CLUB_ADMIN_ARCHIVE_GROUPS: ClubAdminArchiveItem[][] = [
  [{ kind: 'icon', Icon: Server, label: '» Overview', path: '/clubs/archive_overview' }],
  [
    { kind: 'group', Icon: Users, label: 'Archive of Users' },
    {
      kind: 'child',
      label: 'All the users profiles',
      path: '/clubMembers/memberList?section=athletes&nav=archive',
    },
    {
      kind: 'child',
      label: 'Athletes\\members',
      path: '/clubMembers/memberList?section=athletes&nav=athletes',
    },
    {
      kind: 'child',
      label: 'Members in pending',
      path: '/clubMembers/memberList?section=pending&nav=athletes',
    },
    {
      kind: 'child',
      label: 'Members archived',
      path: '/clubMembers/memberList?section=archived&nav=archive',
    },
    {
      kind: 'child',
      label: 'Athletes not members',
      path: '/clubMembers/memberList?section=not-members&nav=athletes',
    },
    {
      kind: 'child',
      label: "Athletes' parents & tutors",
      path: '/clubMembers/memberList?section=parents&nav=archive',
    },
    {
      kind: 'child',
      label: 'Club\\Team Staff',
      path: '/clubMembers/memberList?section=staff&nav=archive',
    },
    {
      kind: 'child',
      label: 'Club\\team profile',
      path: '/clubMembers/memberList?section=club-profile&nav=archive',
    },
  ],
  [
    { kind: 'icon', Icon: Building2, label: 'Customers', path: '/clubs/archive_customers' },
    { kind: 'icon', Icon: Briefcase, label: 'Suppliers', path: '/clubs/archive_suppliers' },
  ],
  [
    { kind: 'group', Icon: ClipboardCheck, label: 'Checkings documents' },
    {
      kind: 'child',
      label: 'Medical certifications of the members',
      path: '/clubs/archive_deadlines?kind=medical-members',
    },
    {
      kind: 'child',
      label: 'Medical certifications of the staff',
      path: '/clubs/archive_deadlines?kind=medical-staff',
    },
    {
      kind: 'child',
      label: 'ID card expirations',
      path: '/clubs/archive_deadlines?kind=id-card',
    },
    {
      kind: 'child',
      label: 'Sports membership card expiration',
      path: '/clubs/archive_deadlines?kind=sports-membership',
    },
  ],
  [
    { kind: 'group', Icon: Calendar, label: 'Recurrence check' },
    { kind: 'child', label: 'Birthdays', path: '/clubs/archive_events?occasion=birthdays' },
    { kind: 'child', label: 'Namedays', path: '/clubs/archive_events?occasion=name-days' },
    { kind: 'child', label: 'Special events', path: '/clubs/archive_events?occasion=special' },
  ],
  [
    { kind: 'affiliate', label: 'Affiliations', path: '/clubMembers/membership' },
    {
      kind: 'icon',
      Icon: Contact2,
      label: 'Subscriptions to the club\\team',
      path: '/clubs/subscription',
    },
  ],
  [
    { kind: 'icon', Icon: Users, label: 'Archive of Users', path: '/clubMembers/memberList?section=athletes&nav=archive' },
    { kind: 'icon', Icon: UserCog, label: 'Operators', path: '/clubs/club_operatorlist' },
    { kind: 'icon', Icon: User, label: 'Employees', path: '/clubs/archive_employees' },
    { kind: 'icon', Icon: CreditCard, label: 'Accesses', path: '/clubs/access_list' },
  ],
  [
    { kind: 'icon', Icon: Hourglass, label: 'Archive of Deadlines', path: '/clubs/archive_deadlines' },
    { kind: 'icon', Icon: Award, label: 'Credit voucher', path: '/clubSettings/creditCustomer' },
    { kind: 'icon', Icon: Hourglass, label: 'Other debts', path: '/clubs/other_debts' },
    { kind: 'icon', Icon: Hourglass, label: 'Planned expenses', path: '/clubs/arc_expenses' },
  ],
  [
    { kind: 'icon', Icon: ShoppingCart, label: 'Shop/Selling of products', path: '/ArchiveSeles/product_sale_list' },
    { kind: 'icon', Icon: Users2, label: 'Archive of Memberships', path: '/clubs/memberships/archive' },
    { kind: 'icon', Icon: BookOpen, label: 'Archive of Course Subs', path: '/clubs/courses/archive' },
    { kind: 'icon', Icon: FileText, label: 'Archive of Services', path: '/clubs/archive_service_list' },
    { kind: 'icon', Icon: Receipt, label: 'Member expenses', path: '/clubs/new_expense' },
    { kind: 'icon', Icon: FileStack, label: 'Archive of Expenses', path: '/clubs/archive_expense_list' },
  ],
  [
    { kind: 'icon', Icon: CornerDownLeft, label: 'Cash In', path: '/clubs/movement_cash_details/IN' },
    { kind: 'icon', Icon: CornerDownRight, label: 'Cash Out', path: '/clubs/movement_cash_details/OUT' },
    { kind: 'icon', Icon: Repeat2, label: 'Cash (all movements)', path: '/clubs/movement_cash_details' },
  ],
  [
    { kind: 'icon', Icon: ClipboardCheck, label: 'Archive of Receipts', path: '/clubs/archive_receipts' },
  ],
  [
    { kind: 'icon', Icon: FileStack, label: 'Cards assignments', path: '/clubs/cards_assignments' },
    { kind: 'icon', Icon: FileWarning, label: 'Alert assigned', path: '/clubs/alerts_assigned' },
  ],
  [
    { kind: 'icon', Icon: Paperclip, label: 'Reservations', path: '/clubs/archive_reservations' },
    { kind: 'icon', Icon: Phone, label: 'Contacts of marketing', path: '/clubs/marketing_contacts' },
    { kind: 'icon', Icon: Calendar, label: 'Events', path: '/clubs/archive_events' },
  ],
  [
    { kind: 'icon', Icon: Presentation, label: 'Polls', path: '/clubs/archive_polls' },
    { kind: 'icon', Icon: Megaphone, label: 'Advertising campaigns', path: '/clubs/advertising_campaigns' },
    {
      kind: 'icon',
      Icon: HelpCircle,
      label: 'Queries to the staff ...',
      path: '/clubs/staff_queries',
    },
  ],
];

/** Mngmnt sub-buttons → existing archives (scoped with ?memberId=). */
export const MEMBER_OVERVIEW_MNGMNT_LINKS: { label: string; path: string }[] = [
  { label: 'Bookings', path: '/clubs/archive_reservations' },
  { label: 'Subscriptions', path: '/clubs/subscription' },
  { label: 'Accesses', path: '/clubs/access_list' },
  { label: 'Memberships', path: '/clubs/memberships/archive' },
  { label: 'Purchases', path: '/ArchiveSeles/product_sale_list' },
  { label: 'Services', path: '/clubs/archive_service_list' },
  { label: 'Deadlines', path: '/clubs/archive_deadlines' },
  { label: 'Credits', path: '/clubMembers/member_credit_list' },
  { label: 'Payments', path: '/clubs/archive_payments' },
  { label: 'Receipts', path: '/clubs/archive_receipts' },
];

export function appendMemberIdToPath(path: string, memberId: string): string {
  const [base, query = ''] = path.split('?');
  const qs = new URLSearchParams(query);
  qs.set('memberId', memberId);
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}
