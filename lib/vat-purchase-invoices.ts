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

export const vatPurchaseInvoiceApi = {
  getStats: () =>
    authFetch('/vat-purchase-invoices/stats'),

  getMonthlySummary: (year?: number) =>
    authFetch(`/vat-purchase-invoices/summary${year ? `?year=${year}` : ''}`),

  getPrefill: (purchaseOrderId?: number) =>
    authFetch(`/vat-purchase-invoices/prefill${purchaseOrderId ? `?purchaseOrderId=${purchaseOrderId}` : ''}`),

  getPendingPOs: () =>
    authFetch('/vat-purchase-invoices/pending-pos'),

  getList: (params?: Record<string, string>) =>
    authFetch(`/vat-purchase-invoices${params ? '?' + new URLSearchParams(params) : ''}`),

  getOne: (id: number) =>
    authFetch(`/vat-purchase-invoices/${id}`),

  create: (body: unknown) =>
    authFetch('/vat-purchase-invoices', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: number, body: unknown) =>
    authFetch(`/vat-purchase-invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  confirm: (id: number) =>
    authFetch(`/vat-purchase-invoices/${id}/confirm`, { method: 'POST', body: JSON.stringify({}) }),

  cancel: (id: number, body: { cancelReason: string }) =>
    authFetch(`/vat-purchase-invoices/${id}/cancel`, { method: 'POST', body: JSON.stringify(body) }),
};
