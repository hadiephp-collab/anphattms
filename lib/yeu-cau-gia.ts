import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Lỗi server'), { status: res.status, data });
  return data as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type YCGStatus = 'ChoXetDuyet' | 'DaDuyet' | 'TuChoi' | 'DaHuy';

export interface YeuCauGia {
  id: number;
  code: string;
  productId: number;
  productCode: string;
  productName: string;
  orderId: number | null;
  orderCode: string | null;
  currentPrice: number;
  proposedPrice: number;
  discountPct: number;
  quantity: number;
  reason: string;
  saleNote: string | null;
  status: YCGStatus;
  createdById: number | null;
  createdByName: string | null;
  reviewedById: number | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  approvedPrice: number | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface YCGKpi {
  choXetDuyet: number;
  daDuyet: number;
  tuChoi: number;
  daHuy: number;
  tong: number;
  tyLeDuyet: number;
  giaGiamTBPct: number;
}

export interface TopSPRow {
  productId: number;
  productCode: string;
  productName: string;
  soLanYeuCau: number;
}

export interface YCGListResult {
  data: YeuCauGia[];
  total: number;
  page: number;
  limit: number;
  kpi: YCGKpi;
  topSP: TopSPRow[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const ycgApi = {
  getAll: (params?: Record<string, string>) =>
    authFetch<YCGListResult>(
      `/yeu-cau-gia${params ? '?' + new URLSearchParams(params) : ''}`,
    ),

  getOne: (id: number) => authFetch<YeuCauGia>(`/yeu-cau-gia/${id}`),

  create: (data: {
    productId: number;
    orderId?: number;
    proposedPrice: number;
    quantity?: number;
    reason: string;
    saleNote?: string;
  }) =>
    authFetch<YeuCauGia>('/yeu-cau-gia', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  review: (
    id: number,
    data: {
      result: 'DaDuyet' | 'TuChoi';
      approvedPrice?: number;
      reviewNote?: string;
    },
  ) =>
    authFetch<YeuCauGia>(`/yeu-cau-gia/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancel: (id: number, cancelReason?: string) =>
    authFetch<YeuCauGia>(`/yeu-cau-gia/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelReason }),
    }),
};
