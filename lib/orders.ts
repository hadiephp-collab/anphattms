// API client — Đơn Hàng
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

export const ordersApi = {
  getAll:   (params?: Record<string, string>) =>
    authFetch(`/orders${params ? '?' + new URLSearchParams(params) : ''}`),
  getStats: (params?: Record<string, string>) =>
    authFetch(`/orders/stats${params ? '?' + new URLSearchParams(params) : ''}`),
  getOne:   (id: number) => authFetch(`/orders/${id}`),
  create:   (data: object) => authFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),
  update:   (id: number, data: object) => authFetch(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove:   (id: number) => authFetch(`/orders/${id}`, { method: 'DELETE' }),

  updateStatus:        (id: number, status: string) =>
    authFetch(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateInvoiceStatus: (id: number, invoiceStatus: string, skipReason?: string) =>
    authFetch(`/orders/${id}/invoice-status`, { method: 'PATCH', body: JSON.stringify({ invoiceStatus, skipReason }) }),
  cancel:              (id: number, reason?: string) =>
    authFetch(`/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  addPayment:    (id: number, data: object) =>
    authFetch(`/orders/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  removePayment: (id: number, payId: number) =>
    authFetch(`/orders/${id}/payments/${payId}`, { method: 'DELETE' }),

  getAuditLog:            (id: number) => authFetch(`/orders/${id}/audit-log`),
  bulkUpdateStatus:       (ids: number[], status: string) =>
    authFetch('/orders/bulk-update-status', { method: 'POST', body: JSON.stringify({ ids, status }) }),
  bulkUpdateInvoiceStatus: (ids: number[], invoiceStatus: string) =>
    authFetch('/orders/bulk-update-invoice-status', { method: 'POST', body: JSON.stringify({ ids, invoiceStatus }) }),
};
