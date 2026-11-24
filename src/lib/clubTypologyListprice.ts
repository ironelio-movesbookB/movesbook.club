export type TypologyListpriceListRow = {
  id: string;
  typologyId: string;
  typologyName: string;
  packageName: string;
  activeStatus: 'Y' | 'N';
  subscriptionName: string;
  cost: string;
  saleDurationMonths: string;
  installnment: string;
  daysRecursion: string;
  saleMaxNumber: string;
  firstCostInstallnment: string;
  renewalNextDiscount: string;
  conditionRenewalStatus: boolean;
};

export type TypologyListpriceForm = {
  typologyId: string;
  activeStatus: boolean;
  subscriptionName: string;
  searchKeyword: string;
  cost: string;
  discount: string;
  expiryDate: string;
  installnment: string;
  firstCostInstallnment: string;
  daysRecursion: string;
  fixExpiryDayStatus: boolean;
  fixExpiryDay: string;
  conditionRenewalStatus: boolean;
  suspensionAvailableStatus: boolean;
  renewalNextDiscount: string;
  suspensionMaxDays: string;
  saleDurationMonths: string;
  saleNumberAccess: string;
  saleRelatedDays: string;
  saleMaxNumber: string;
  saleCostAccess: string;
  saleNumberAccessStatus: boolean;
  saleMaxNumberStatus: boolean;
  recursiveExpires: boolean;
  subscriptionPointsStatus: boolean;
  subscriptionPoints: string;
};

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function yesNo(value: unknown, fallback: 'Y' | 'N' = 'N'): 'Y' | 'N' {
  if (value === 'Y' || value === 'y' || value === true || value === 1 || value === '1') {
    return 'Y';
  }
  if (value === 'N' || value === 'n' || value === false || value === 0 || value === '0') {
    return 'N';
  }
  return fallback;
}

export function boolFromYesNo(value: unknown): boolean {
  return yesNo(value) === 'Y';
}

export function createEmptyListpriceForm(typologyId = ''): TypologyListpriceForm {
  return {
    typologyId,
    activeStatus: true,
    subscriptionName: '',
    searchKeyword: '',
    cost: '',
    discount: '',
    expiryDate: '',
    installnment: '1',
    firstCostInstallnment: '',
    daysRecursion: '',
    fixExpiryDayStatus: false,
    fixExpiryDay: '',
    conditionRenewalStatus: false,
    suspensionAvailableStatus: false,
    renewalNextDiscount: '',
    suspensionMaxDays: '',
    saleDurationMonths: '',
    saleNumberAccess: '',
    saleRelatedDays: '',
    saleMaxNumber: '',
    saleCostAccess: '',
    saleNumberAccessStatus: true,
    saleMaxNumberStatus: false,
    recursiveExpires: false,
    subscriptionPointsStatus: false,
    subscriptionPoints: ''
  };
}

export function mapDbRowToListpriceForm(row: Record<string, unknown>): TypologyListpriceForm {
  const maxAccessSelected = boolFromYesNo(row.sale_max_number_status);
  return {
    typologyId: text(row.typology_id),
    activeStatus: boolFromYesNo(row.active_status),
    subscriptionName: text(row.subscription_name),
    searchKeyword: text(row.search_keyword),
    cost: text(row.cost),
    discount: text(row.discount),
    expiryDate: text(row.expiry_date),
    installnment: text(row.installnment) || '1',
    firstCostInstallnment: text(row.first_cost_installnment),
    daysRecursion: text(row.days_recursion),
    fixExpiryDayStatus: boolFromYesNo(row.fix_expiry_day_status),
    fixExpiryDay: text(row.fix_expiry_day),
    conditionRenewalStatus: boolFromYesNo(row.coundition_renewal_status),
    suspensionAvailableStatus: boolFromYesNo(row.suspension_available_status),
    renewalNextDiscount: text(row.renewal_next_discount),
    suspensionMaxDays: text(row.suspension_max_days),
    saleDurationMonths: text(row.sale_duration_months),
    saleNumberAccess: text(row.sale_number_access),
    saleRelatedDays: text(row.sale_related_days),
    saleMaxNumber: text(row.sale_max_number),
    saleCostAccess: text(row.sale_cost_access),
    saleNumberAccessStatus: maxAccessSelected ? false : true,
    saleMaxNumberStatus: maxAccessSelected,
    recursiveExpires: boolFromYesNo(row.recursive_expires),
    subscriptionPointsStatus: boolFromYesNo(row.subscripion_points_status),
    subscriptionPoints: text(row.subscripion_points)
  };
}

export function buildListpriceDbValues(form: TypologyListpriceForm): Record<string, unknown> {
  return {
    typology_id: text(form.typologyId),
    subscription_name: text(form.subscriptionName),
    active_status: yesNo(form.activeStatus),
    search_keyword: text(form.searchKeyword),
    cost: text(form.cost),
    discount: text(form.discount),
    expiry_date: text(form.expiryDate) || null,
    installnment: text(form.installnment),
    first_cost_installnment: text(form.firstCostInstallnment),
    days_recursion: text(form.daysRecursion),
    fix_expiry_day_status: yesNo(form.fixExpiryDayStatus),
    fix_expiry_day: text(form.fixExpiryDay),
    coundition_renewal_status: yesNo(form.conditionRenewalStatus),
    suspension_available_status: yesNo(form.suspensionAvailableStatus),
    renewal_next_discount: text(form.renewalNextDiscount),
    suspension_max_days: text(form.suspensionMaxDays),
    sale_duration_months: text(form.saleDurationMonths),
    sale_number_access: text(form.saleNumberAccess),
    sale_related_days: text(form.saleRelatedDays),
    sale_max_number: text(form.saleMaxNumber),
    sale_cost_access: text(form.saleCostAccess),
    sale_number_access_status: yesNo(form.saleNumberAccessStatus),
    sale_max_number_status: yesNo(form.saleMaxNumberStatus),
    recursive_expires: yesNo(form.recursiveExpires),
    subscripion_points_status: yesNo(form.subscriptionPointsStatus),
    subscripion_points: text(form.subscriptionPoints)
  };
}

export function mapDbRowToListpriceListRow(
  row: Record<string, unknown>,
  typologyName: string,
  packageName: string
): TypologyListpriceListRow {
  return {
    id: text(row.id),
    typologyId: text(row.typology_id),
    typologyName,
    packageName,
    activeStatus: yesNo(row.active_status, 'N'),
    subscriptionName: text(row.subscription_name),
    cost: text(row.cost),
    saleDurationMonths: text(row.sale_duration_months),
    installnment: text(row.installnment),
    daysRecursion: text(row.days_recursion),
    saleMaxNumber: text(row.sale_max_number),
    firstCostInstallnment: text(row.first_cost_installnment),
    renewalNextDiscount: text(row.renewal_next_discount),
    conditionRenewalStatus: boolFromYesNo(row.coundition_renewal_status)
  };
}
