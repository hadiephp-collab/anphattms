import { getToken } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type HealthState = 'AN_TOAN' | 'CANH_BAO' | 'NGUY_HIEM' | 'CHUA_CAU_HINH';

export interface CapitalDashboard {
  capitalAmount: number;
  tasRong: number;
  totalAssets: number;
  totalDebt: number;
  diff: number;
  healthState: HealthState;
  threshold: number;
  breakdown: {
    assets: { label: string; amount: number }[];
    debts: { label: string; amount: number }[];
  };
  warnings: string[];
  calculatedAt: string;
}

export interface CapitalHistory {
  id: number;
  code: string;
  oldAmount: number;
  newAmount: number;
  changeType: 'FIRST_TIME' | 'INCREASE' | 'DECREASE';
  reason: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface CapitalConfig {
  threshold: number;
  emailAlert: boolean;
  inAppAlert: boolean;
  warning?: string;
}

export interface BreakEvenOk {
  ok: true;
  chiPhiCoDinh: number;
  bienLNGop: number;
  bienLNGopPct: number;
  breakEven: number;
  doanhThuThangNay: number;
  conThieu: number;
  cuaSoThang: { month: number; year: number; revenue: number; cost: number; pct: number }[];
  n: number;
  warnings: string[];
  state: 'S2' | 'S3' | 'S4';
  period: { month: number; year: number };
}

export interface BreakEvenError {
  ok: false;
  businessError: true;
  code: 'NO_HISTORY_DATA' | 'BIEN_LN_NOT_POS';
  error: string;
  partialData: Record<string, number>;
}

export type BreakEvenResult = BreakEvenOk | BreakEvenError;

export interface BreakEvenDetail {
  chiTiet: { category: string; amount: number; source: string }[];
  tongPhieuChi: number;
  tongKhauHao: number;
  tongChiPhiCoDinh: number;
}

// ─── API ───────────────────────────────────────────────────────────────────────

export const capitalApi = {
  getDashboard: (): Promise<CapitalDashboard> => req('/capital/dashboard'),

  getTasRong: () => req('/capital/tas-rong'),

  getHistory: (params?: { fromDate?: string; toDate?: string; page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.fromDate) qs.set('fromDate', params.fromDate);
    if (params?.toDate) qs.set('toDate', params.toDate);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.size) qs.set('size', String(params.size));
    return req(`/capital/history?${qs}`);
  },

  updateCapital: (body: { newAmount: number; reason?: string }) =>
    req('/capital/update', { method: 'POST', body: JSON.stringify(body) }),

  getConfig: (): Promise<CapitalConfig> => req('/capital/config'),

  updateConfig: (body: { threshold?: number; emailAlert?: boolean; inAppAlert?: boolean }) =>
    req('/capital/config', { method: 'PATCH', body: JSON.stringify(body) }),
};

export const breakEvenApi = {
  calc: (month: number, year: number): Promise<BreakEvenResult> =>
    req(`/breakeven?month=${month}&year=${year}`),

  detail: (month: number, year: number): Promise<BreakEvenDetail> =>
    req(`/breakeven/detail?month=${month}&year=${year}`),
};
