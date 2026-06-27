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

export const vatExportApi = {
  getStats: () =>
    authFetch('/vat-exports/stats'),

  getList: (params?: Record<string, string>) =>
    authFetch(`/vat-exports${params ? '?' + new URLSearchParams(params) : ''}`),

  getOne: (id: number) =>
    authFetch(`/vat-exports/${id}`),

  getPrefill: (orderId?: number) =>
    authFetch(`/vat-exports/prefill${orderId ? `?orderId=${orderId}` : ''}`),

  getPendingOrders: (params?: Record<string, string>) =>
    authFetch(`/vat-exports/pending-orders${params ? '?' + new URLSearchParams(params) : ''}`),

  create: (body: unknown) =>
    authFetch('/vat-exports', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: number, body: unknown) =>
    authFetch(`/vat-exports/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  void: (id: number, body: { voidReason: string }) =>
    authFetch(`/vat-exports/${id}/void`, { method: 'POST', body: JSON.stringify(body) }),

  markNoInvoice: (orderId: number, body: { reason: string }) =>
    authFetch(`/vat-exports/orders/${orderId}/no-invoice`, { method: 'PATCH', body: JSON.stringify(body) }),

  undoNoInvoice: (orderId: number) =>
    authFetch(`/vat-exports/orders/${orderId}/undo-no-invoice`, { method: 'PATCH', body: JSON.stringify({}) }),
};
