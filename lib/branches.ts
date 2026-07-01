import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : (data.message || 'Lỗi server'));
  return data;
}

export interface Branch {
  id: number;
  code: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  nguoiPhuTrach: string | null;
  soNhanVien: number | null;
  timezone: string;
  isDefault: boolean;
  isActive: boolean;
  ghiChu: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchFormData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  nguoiPhuTrach?: string;
  soNhanVien?: number;
  timezone?: string;
  isActive?: boolean;
  ghiChu?: string;
}

export const branchesApi = {
  getAll: (activeOnly?: boolean): Promise<Branch[]> =>
    authFetch(`/branches${activeOnly ? '?activeOnly=true' : ''}`),
  getOne: (id: number): Promise<Branch> =>
    authFetch(`/branches/${id}`),
  create: (data: BranchFormData): Promise<Branch> =>
    authFetch('/branches', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: BranchFormData): Promise<Branch> =>
    authFetch(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setDefault: (id: number): Promise<Branch> =>
    authFetch(`/branches/${id}/set-default`, { method: 'POST' }),
  remove: (id: number): Promise<{ message: string }> =>
    authFetch(`/branches/${id}`, { method: 'DELETE' }),
};
