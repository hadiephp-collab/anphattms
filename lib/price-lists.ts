const BASE = 'http://localhost:3001/price-lists';

function headers() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('anphat_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function req<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...opts, headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message ?? 'Lỗi'), { status: res.status, data: err });
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type NhomGia = 'Le' | 'NoiBo' | 'TM1' | 'TM2' | 'TM3';

export interface MatrixRow {
  productId:    number;
  code:         string;
  name:         string;
  sellingPrice: number;
  Le:    number | null;
  NoiBo: number | null;
  TM1:   number | null;
  TM2:   number | null;
  TM3:   number | null;
}

export interface PriceList {
  id:           number;
  name:         string;
  description:  string | null;
  type:         'fixed' | 'pct';
  pctDiscount:  number;
  validFrom:    string | null;
  validTo:      string | null;
  isActive:     boolean;
  productCount: number;
  createdAt:    string;
}

export interface PriceListItem {
  id:           number;
  productId:    number;
  code:         string;
  name:         string;
  sellingPrice: number;
  price:        number;
}

export interface PriceListDetail extends PriceList {
  items: PriceListItem[];
}

export interface ResolvedPrice {
  productId:     number;
  resolvedPrice: number;
  source:        string;
  sellingPrice:  number;
  nhomGia:       string | null;
  priceListId:   number | null;
}

// ─── Ma trận 5 nhóm ──────────────────────────────────────────────────────────

export const getMatrix = (search?: string): Promise<MatrixRow[]> =>
  req(`${BASE}/matrix${search ? `?search=${encodeURIComponent(search)}` : ''}`);

export const batchUpsertPrices = (
  items: { productId: number; nhomGia: NhomGia; donGia: number }[],
): Promise<{ saved: number }> =>
  req(`${BASE}/matrix/batch`, { method: 'POST', body: JSON.stringify({ items }) });

// ─── Bảng giá đặt tên ────────────────────────────────────────────────────────

export const getPriceLists = (onlyActive = false): Promise<PriceList[]> =>
  req(`${BASE}?active=${onlyActive}`);

export const getPriceListDetail = (id: number): Promise<PriceListDetail> =>
  req(`${BASE}/${id}`);

export const createPriceList = (data: {
  name: string;
  description?: string;
  type: 'fixed' | 'pct';
  pctDiscount?: number;
  validFrom?: string;
  validTo?: string;
}): Promise<PriceList> =>
  req(BASE, { method: 'POST', body: JSON.stringify(data) });

export const updatePriceList = (id: number, data: Partial<{
  name: string;
  description: string;
  type: 'fixed' | 'pct';
  pctDiscount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}>): Promise<PriceList> =>
  req(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deletePriceList = (id: number): Promise<{ deleted: boolean }> =>
  req(`${BASE}/${id}`, { method: 'DELETE' });

export const copyPriceList = (id: number, name?: string): Promise<PriceListDetail> =>
  req(`${BASE}/${id}/copy`, { method: 'POST', body: JSON.stringify({ name }) });

export const savePriceListItems = (
  id: number,
  rows: { productId: number; price: number }[],
): Promise<{ saved: number }> =>
  req(`${BASE}/${id}/items`, { method: 'POST', body: JSON.stringify({ rows }) });

export const removePriceListItem = (id: number, productId: number): Promise<{ deleted: boolean }> =>
  req(`${BASE}/${id}/items/${productId}`, { method: 'DELETE' });

// ─── Resolve giá theo đối tác ────────────────────────────────────────────────

export const resolvePrices = (
  productIds: number[],
  partnerId?: number,
): Promise<ResolvedPrice[]> =>
  req(`${BASE}/resolve-batch`, {
    method: 'POST',
    body: JSON.stringify({ productIds, partnerId }),
  });
