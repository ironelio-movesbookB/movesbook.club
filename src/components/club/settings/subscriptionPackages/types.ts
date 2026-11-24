export type PackageService = {
  id: string;
  sectorId: string;
  sectorName: string;
  serviceName: string;
  cost: string;
  actualCost: string;
  currencyCode: string;
  imageUrl: string | null;
  image1Url: string | null;
  image2Url: string | null;
  videoUrl: string;
  showCost: boolean;
  orderPosition: number;
};

export type ListpriceSummary = {
  id: string;
  typologyId: string;
  typologyName: string;
  subscriptionName: string;
};

export type PackageDetail = {
  id: string | null;
  listpriceId: string;
  packageName: string;
  putTable: boolean;
  serviceIds: string[];
  packageFeature: string;
};

export type PackageDetailResponse = {
  listprice: ListpriceSummary;
  pricelistOptions: { id: string; label: string }[];
  package: PackageDetail;
  services: PackageService[];
};

export type PackageTableRow = {
  id: string;
  listpriceId: string;
  packageName: string;
  typologyName: string;
  subscriptionName: string;
  packageFeature: string;
  totalCost: number;
  serviceIds: string[];
};

export async function authFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Request failed');
  return data as T;
}
