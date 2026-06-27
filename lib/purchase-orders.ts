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

export const purchaseOrdersApi = {
  getAll:   (params?: Record<string, string>) =>
    authFetch(`/purchase-orders${params ? '?' + new URLSearchParams(params) : ''}`),
  getStats: (params?: Record<string, string>) =>
    authFetch(`/purchase-orders/stats${params ? '?' + new URLSearchParams(params) : ''}`),
  getOne:   (id: number) => authFetch(`/purchase-orders/${id}`),
  create:   (data: object) => authFetch('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  update:   (id: number, data: object) =>
    authFetch(`/purchase-orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove:   (id: number) => authFetch(`/purchase-orders/${id}`, { method: 'DELETE' }),

  updateStatus: (id: number, data: object) =>
    authFetch(`/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancel:       (id: number, reason?: string) =>
    authFetch(`/purchase-orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  addPayment:    (id: number, data: object) =>
    authFetch(`/purchase-orders/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  removePayment: (id: number, payId: number) =>
    authFetch(`/purchase-orders/${id}/payments/${payId}`, { method: 'DELETE' }),

  getAuditLog:      (id: number) => authFetch(`/purchase-orders/${id}/audit-log`),
  bulkUpdateStatus: (ids: number[], status: string) =>
    authFetch('/purchase-orders/bulk-update-status', { method: 'POST', body: JSON.stringify({ ids, status }) }),

  getCosts:    (id: number) => authFetch(`/purchase-orders/${id}/costs`),
  addCost:     (id: number, data: object) =>
    authFetch(`/purchase-orders/${id}/costs`, { method: 'POST', body: JSON.stringify(data) }),
  updateCost:  (id: number, costId: number, data: object) =>
    authFetch(`/purchase-orders/${id}/costs/${costId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeCost:  (id: number, costId: number) =>
    authFetch(`/purchase-orders/${id}/costs/${costId}`, { method: 'DELETE' }),
};
