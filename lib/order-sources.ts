import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Lỗi server');
  return data;
}

export interface OrderSource {
  id: number;
  code: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  orderCount?: number;
  revenue?: number;
}

export interface OrderSourceStats {
  total: number;
  active: number;
  sources: OrderSource[];
}

export const orderSourcesApi = {
  getAll: (activeOnly?: boolean): Promise<OrderSource[]> => {
    const q = activeOnly ? '?active=true' : '';
    return authFetch(`/order-sources${q}`);
  },

  getStats: (): Promise<OrderSourceStats> => authFetch('/order-sources/stats'),

  create: (data: { name: string; color?: string; sortOrder?: number }): Promise<OrderSource> =>
    authFetch('/order-sources', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: { name?: string; color?: string; sortOrder?: number; isActive?: boolean }): Promise<OrderSource> =>
    authFetch(`/order-sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  remove: (id: number): Promise<void> =>
    authFetch(`/order-sources/${id}`, { method: 'DELETE' }),
};
