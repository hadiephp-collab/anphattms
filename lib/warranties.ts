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

export interface Warranty {
  id: number;
  code: string;
  orderId: number | null;
  orderCode: string | null;
  customerId: number | null;
  customerName: string | null;
  productId: number;
  productCode: string;
  productName: string;
  serial: string | null;
  startDate: string;
  endDate: string;
  warrantyMonths: number;
  totalMonths: number;
  status: 'active' | 'used';
  runtimeStatus: 'active' | 'expiringSoon' | 'expired' | 'used';
  branchId: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WarrantyKpi {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  used: number;
}

export interface WarrantyListResponse {
  data: Warranty[];
  total: number;
  kpi: WarrantyKpi;
}

export interface CheckSerialResponse {
  found: boolean;
  active: boolean;
  message: string;
  daysLeft: number | null;
  warranty: Warranty | null;
}

export interface ExtendWarrantyResponse {
  message: string;
  warranty: Warranty;
  newEndDate: string;
}

// ─── Warranty Requests ───────────────────────────────────────────────────────

export interface WarrantyRequest {
  id: number;
  code: string;
  warrantyId: number | null;
  warrantyCode: string | null;
  customerId: number | null;
  customerName: string | null;
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  serial: string | null;
  issueDescription: string;
  receivedDate: string;
  receivedById: number | null;
  receivedByName: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'returned' | 'rejected';
  resolution: 'repaired' | 'replaced' | 'rejected' | 'other' | null;
  resolutionNote: string | null;
  estimatedReturnDate: string | null;
  actualReturnDate: string | null;
  branchId: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WarrantyRequestKpi {
  total: number;
  pending: number;
  inProgress: number;
  done: number;
  returned: number;
  rejected: number;
}

export interface WarrantyRequestListResponse {
  data: WarrantyRequest[];
  total: number;
  page: number;
  limit: number;
  kpi: WarrantyRequestKpi;
}

export const warrantyRequestsApi = {
  getAll: (params?: {
    q?: string;
    status?: string;
    branchId?: number;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<WarrantyRequestListResponse> => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.branchId) qs.set('branchId', String(params.branchId));
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const str = qs.toString();
    return authFetch(`/warranty-requests${str ? `?${str}` : ''}`);
  },

  getOne: (id: number): Promise<WarrantyRequest> =>
    authFetch(`/warranty-requests/${id}`),

  create: (data: {
    warrantyId?: number;
    customerId?: number;
    customerName?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    serial?: string;
    issueDescription: string;
    receivedDate: string;
    receivedByName?: string;
    estimatedReturnDate?: string;
    branchId?: number;
    notes?: string;
  }): Promise<WarrantyRequest> =>
    authFetch('/warranty-requests', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<{
    status: string;
    resolution: string;
    resolutionNote: string;
    estimatedReturnDate: string;
    actualReturnDate: string;
    issueDescription: string;
    serial: string;
    notes: string;
  }>): Promise<WarrantyRequest> =>
    authFetch(`/warranty-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: number): Promise<{ message: string }> =>
    authFetch(`/warranty-requests/${id}`, { method: 'DELETE' }),
};

// ─── Warranties API ───────────────────────────────────────────────────────────

export const warrantiesApi = {
  getAll: (params?: {
    q?: string;
    status?: string;
    productId?: number;
    customerId?: number;
    branchId?: number;
    page?: number;
    limit?: number;
  }): Promise<WarrantyListResponse> => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.productId) qs.set('productId', String(params.productId));
    if (params?.customerId) qs.set('customerId', String(params.customerId));
    if (params?.branchId) qs.set('branchId', String(params.branchId));
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const str = qs.toString();
    return authFetch(`/warranties${str ? `?${str}` : ''}`);
  },

  getOne: (id: number): Promise<Warranty> =>
    authFetch(`/warranties/${id}`),

  checkSerial: (serial: string): Promise<CheckSerialResponse> =>
    authFetch(`/warranties/check?serial=${encodeURIComponent(serial)}`),

  update: (id: number, data: { serial?: string; notes?: string; status?: 'active' | 'used' }): Promise<Warranty> =>
    authFetch(`/warranties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  extend: (id: number, months: number): Promise<ExtendWarrantyResponse> =>
    authFetch(`/warranties/${id}/extend`, { method: 'POST', body: JSON.stringify({ months }) }),

  remove: (id: number): Promise<{ message: string }> =>
    authFetch(`/warranties/${id}`, { method: 'DELETE' }),
};
