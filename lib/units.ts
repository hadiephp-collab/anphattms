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

export interface UnitOfMeasure {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UnitStats {
  total: number;
  active: number;
  inactive: number;
}

export interface UnitListResponse {
  data: UnitOfMeasure[];
  stats: UnitStats;
}

export interface CreateUnitData {
  code: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface UpdateUnitData {
  name?: string;
  description?: string;
  isDefault?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export const unitsApi = {
  getAll: (search?: string, activeOnly?: boolean): Promise<UnitListResponse> => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (activeOnly) params.set('activeOnly', 'true');
    const qs = params.toString();
    return authFetch(`/units${qs ? `?${qs}` : ''}`);
  },
  getActive: (): Promise<UnitOfMeasure[]> =>
    authFetch('/units/active'),
  getOne: (id: number): Promise<UnitOfMeasure> =>
    authFetch(`/units/${id}`),
  create: (data: CreateUnitData): Promise<UnitOfMeasure> =>
    authFetch('/units', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: UpdateUnitData): Promise<UnitOfMeasure> =>
    authFetch(`/units/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  setDefault: (id: number): Promise<UnitOfMeasure> =>
    authFetch(`/units/${id}/set-default`, { method: 'POST' }),
  remove: (id: number): Promise<{ message: string; id: number }> =>
    authFetch(`/units/${id}`, { method: 'DELETE' }),
};
