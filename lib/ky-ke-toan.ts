import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Lỗi server');
  return data;
}

export interface KyKeToan {
  maKy: string;
  thang: number;
  nam: number;
  trangThai: 'DangMo' | 'DaKhoa';
  isReopened: boolean;
  ngayKhoa: string | null;
  nguoiKhoa: string | null;
  ngayMoLai: string | null;
  nguoiMoLai: string | null;
  lyDoMoLai: string | null;
  snapshotJSON: SnapshotData | null;
  snapshotVersion: number;
  checklistOverrideNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotData {
  period: { thang: number; nam: number };
  doanhThuBanHang: { doanhThu: number; soDon: number; daThu: number };
  thuChi: { tongThu: number; tongChi: number; chenh: number };
  vat: { vatDauRa: number; vatDauVao: number; vatPhaiNop: number };
  nhapHang: { tongNhap: number };
  congNo: { phaiThu: number; phaiTra: number };
  generatedAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  count: number;
  type: 'warning' | 'block';
  passed: boolean;
  canOverride: boolean;
}

export interface KyKeToanAudit {
  id: number;
  maKy: string;
  action: string;
  username: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export const kyKeToanApi = {
  getAll: (): Promise<KyKeToan[]> =>
    authFetch('/ky-ke-toan'),

  getOne: (maKy: string): Promise<KyKeToan> =>
    authFetch(`/ky-ke-toan/${encodeURIComponent(maKy)}`),

  create: (data: { thang: number; nam: number; createdBy?: string }): Promise<KyKeToan> =>
    authFetch('/ky-ke-toan', { method: 'POST', body: JSON.stringify(data) }),

  runChecklist: (maKy: string): Promise<ChecklistItem[]> =>
    authFetch(`/ky-ke-toan/${encodeURIComponent(maKy)}/checklist`, { method: 'POST' }),

  lock: (maKy: string, data: { lockedBy?: string; overrideNote?: string }): Promise<KyKeToan> =>
    authFetch(`/ky-ke-toan/${encodeURIComponent(maKy)}/lock`, { method: 'POST', body: JSON.stringify(data) }),

  reopen: (maKy: string, data: { lyDo: string; reopenedBy?: string }): Promise<KyKeToan> =>
    authFetch(`/ky-ke-toan/${encodeURIComponent(maKy)}/reopen`, { method: 'POST', body: JSON.stringify(data) }),

  getAuditLog: (maKy?: string): Promise<KyKeToanAudit[]> =>
    authFetch(`/ky-ke-toan/audit${maKy ? `?maKy=${encodeURIComponent(maKy)}` : ''}`),

  isLocked: (ngay: string): Promise<boolean> =>
    authFetch(`/ky-ke-toan/is-locked?ngay=${encodeURIComponent(ngay)}`),
};
