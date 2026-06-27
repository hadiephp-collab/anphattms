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

export const returnsApi = {
  getStats:   () => authFetch('/returns/stats'),
  getAll:     (params?: Record<string, string>) =>
    authFetch(`/returns${params ? '?' + new URLSearchParams(params) : ''}`),
  getOne:     (id: number) => authFetch(`/returns/${id}`),
  create:     (data: object) => authFetch('/returns', { method: 'POST', body: JSON.stringify(data) }),
  approve:    (id: number) => authFetch(`/returns/${id}/approve`, { method: 'PATCH' }),
  reject:     (id: number, rejectReason: string) =>
    authFetch(`/returns/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ rejectReason }) }),
  cancel:     (id: number) => authFetch(`/returns/${id}/cancel`, { method: 'PATCH' }),
  remove:     (id: number) => authFetch(`/returns/${id}`, { method: 'DELETE' }),
  byOrder:    (orderId: number) => authFetch(`/returns/by-order/${orderId}`),
};
