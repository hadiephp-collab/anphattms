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

export interface CancelReturnReason {
  id: number;
  type: 'cancel' | 'return';
  name: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
}

export interface CancelReturnStats {
  cancelTotal: number;
  cancelActive: number;
  returnTotal: number;
  returnActive: number;
}

export const cancelReturnReasonsApi = {
  getAll: (params?: { type?: string; active?: boolean }): Promise<CancelReturnReason[]> => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.active !== undefined) q.set('active', String(params.active));
    return authFetch(`/cancel-return-reasons?${q}`);
  },

  getStats: (): Promise<CancelReturnStats> => authFetch('/cancel-return-reasons/stats'),

  create: (data: { type: string; name: string; sortOrder?: number }): Promise<CancelReturnReason> =>
    authFetch('/cancel-return-reasons', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: { name?: string; sortOrder?: number; isActive?: boolean }): Promise<CancelReturnReason> =>
    authFetch(`/cancel-return-reasons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  remove: (id: number): Promise<{ message: string }> =>
    authFetch(`/cancel-return-reasons/${id}`, { method: 'DELETE' }),
};
