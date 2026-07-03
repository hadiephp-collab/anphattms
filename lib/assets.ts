import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(Array.isArray(data.message) ? data.message.join(', ') : (data.message || 'Lỗi server')), { status: res.status, data });
  return data as T;
}

export interface Asset {
  id: number;
  code: string;
  name: string;
  type: 'TSCD' | 'TSCD_OTO' | 'CCDC';
  originalCost: number;
  depreciableCost: number;
  monthlyDepreciation: number;
  purchaseDate: string;
  depreciationMonths: number;
  depreciationStartDate: string;
  category: string | null;
  department: string | null;
  sourceInvoiceCode: string | null;
  status: 'active' | 'disposed';
  disposedDate: string | null;
  disposedNote: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  // Enriched fields
  monthsDepreciated: number;
  totalDepreciated: number;
  remainingCost: number;
  progressPercent: number;
  monthsLeft: number;
}

export interface AssetDetail extends Asset {
  depreciationLogs: DepreciationLog[];
}

export interface DepreciationLog {
  id: number;
  code: string;
  assetId: number;
  assetCode: string;
  assetName: string;
  month: number;
  year: number;
  periodKey: string;
  amount: number;
  transactionId: number | null;
  category: string | null;
  runById: number | null;
  runByName: string | null;
  createdAt: string;
}

export interface AssetKpi {
  tscdCount: number;
  tscdTotalCost: number;
  tscdMonthlyKH: number;
  tscdExpiredKH: number;
  ccdcCount: number;
  ccdcTotalCost: number;
  ccdcMonthlyKH: number;
  ccdcExpiredKH: number;
}

export interface AssetListResponse {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
  kpi: AssetKpi;
}

export interface DepreciationLogListResponse {
  data: DepreciationLog[];
  total: number;
  page: number;
  limit: number;
  totalAmount: number;
}

export interface RunDepreciationResult {
  processed: number;
  skipped: number;
  totalAmount: number;
  details: { assetId: number; code: string; name: string; amount: number }[];
  skippedList: { assetId: number; code: string; name: string; reason: string }[];
  errors: { assetId: number; code: string; name: string; error: string }[];
}

export const assetsApi = {
  getAll: (params?: {
    q?: string;
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<AssetListResponse> => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.type) qs.set('type', params.type);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const str = qs.toString();
    return authFetch(`/assets${str ? `?${str}` : ''}`);
  },

  getOne: (id: number): Promise<AssetDetail> => authFetch(`/assets/${id}`),

  create: (data: {
    name: string;
    type: string;
    originalCost: number;
    purchaseDate: string;
    depreciationMonths: number;
    depreciationStartDate: string;
    sourceInvoiceCode?: string;
    category?: string;
    department?: string;
    notes?: string;
  }): Promise<{ asset: AssetDetail; warning?: string }> =>
    authFetch('/assets', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: {
    name?: string;
    category?: string;
    department?: string;
    notes?: string;
  }): Promise<AssetDetail> =>
    authFetch(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  dispose: (id: number, data?: { disposedDate?: string; disposedNote?: string }): Promise<{ asset: Asset; message: string }> =>
    authFetch(`/assets/${id}/dispose`, { method: 'POST', body: JSON.stringify(data ?? {}) }),

  remove: (id: number): Promise<{ message: string; id: number }> =>
    authFetch(`/assets/${id}`, { method: 'DELETE' }),

  getLogs: (params?: {
    assetId?: number;
    fromMonth?: string;
    toMonth?: string;
    page?: number;
    limit?: number;
  }): Promise<DepreciationLogListResponse> => {
    const qs = new URLSearchParams();
    if (params?.assetId) qs.set('assetId', String(params.assetId));
    if (params?.fromMonth) qs.set('fromMonth', params.fromMonth);
    if (params?.toMonth) qs.set('toMonth', params.toMonth);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const str = qs.toString();
    return authFetch(`/assets/depreciation-logs${str ? `?${str}` : ''}`);
  },

  runDepreciation: (data: {
    month: number;
    year: number;
    paymentMethod?: string;
    bankAccountId?: number;
  }): Promise<RunDepreciationResult> =>
    authFetch('/assets/run-depreciation', { method: 'POST', body: JSON.stringify(data) }),
};
