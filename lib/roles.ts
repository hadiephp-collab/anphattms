import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(message: string, public readonly data: Record<string, unknown>) {
    super(message);
  }
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message || 'Lỗi server', data as Record<string, unknown>);
  return data;
}

export interface VaiTro {
  maVaiTro: string;
  tenVaiTro: string;
  nhomQuyen: 'admin' | 'ketoan' | 'sale' | 'viewer';
  moTa: string | null;
  active: boolean;
  isSystemRole: boolean;
  nguoiTao: string | null;
  nguoiCapNhat: string | null;
  ngayTao: string;
  ngayCapNhat: string;
  userCount?: number;
}

export interface VaiTroAudit {
  id: number;
  maVaiTro: string;
  action: string;
  actor: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  chiTiet: string | null;
  createdAt: string;
}

export interface RolesListResult {
  data: VaiTro[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: { total: number; active: number; system: number; inactive: number };
}

export interface RoleDetail extends VaiTro {
  users: { id: number; username: string; fullName: string | null }[];
  auditLog: VaiTroAudit[];
}

export const rolesApi = {
  getAll: (params?: {
    search?: string;
    filterStatus?: string;
    filterNhomQuyen?: string;
    page?: number;
    pageSize?: number;
  }): Promise<RolesListResult> => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.filterStatus) q.set('filterStatus', params.filterStatus);
    if (params?.filterNhomQuyen) q.set('filterNhomQuyen', params.filterNhomQuyen);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    return authFetch(`/roles?${q.toString()}`);
  },

  getOne: (maVaiTro: string): Promise<VaiTro> =>
    authFetch(`/roles/${encodeURIComponent(maVaiTro)}`),

  getDetail: (maVaiTro: string): Promise<RoleDetail> =>
    authFetch(`/roles/${encodeURIComponent(maVaiTro)}/detail`),

  getActive: (): Promise<VaiTro[]> => authFetch('/roles/active'),

  checkUnique: (tenVaiTro: string, excludeId?: string): Promise<{ isUnique: boolean }> => {
    const q = new URLSearchParams({ tenVaiTro });
    if (excludeId) q.set('excludeId', excludeId);
    return authFetch(`/roles/check-unique?${q.toString()}`);
  },

  create: (data: { tenVaiTro: string; nhomQuyen: string; moTa?: string; nguoiTao?: string }): Promise<VaiTro> =>
    authFetch('/roles', { method: 'POST', body: JSON.stringify(data) }),

  update: (maVaiTro: string, data: { tenVaiTro?: string; nhomQuyen?: string; moTa?: string; nguoiCapNhat?: string }): Promise<VaiTro> =>
    authFetch(`/roles/${encodeURIComponent(maVaiTro)}`, { method: 'PUT', body: JSON.stringify(data) }),

  deactivate: (maVaiTro: string, actor?: string): Promise<VaiTro> =>
    authFetch(`/roles/${encodeURIComponent(maVaiTro)}/deactivate`, { method: 'POST', body: JSON.stringify({ actor }) }),

  reactivate: (maVaiTro: string, actor?: string): Promise<VaiTro> =>
    authFetch(`/roles/${encodeURIComponent(maVaiTro)}/reactivate`, { method: 'POST', body: JSON.stringify({ actor }) }),

  getAuditLog: (maVaiTro?: string): Promise<VaiTroAudit[]> => {
    const q = maVaiTro ? `?maVaiTro=${encodeURIComponent(maVaiTro)}` : '';
    return authFetch(`/roles/audit${q}`);
  },
};

export { ApiError };
