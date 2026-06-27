import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Lỗi server');
  return data;
}

export const inventoryApi = {
  getFilterOptions: () => authFetch('/inventory/filter-options'),
  getStock:      (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return authFetch(`/inventory/stock${q}`);
  },
  getMovements:  (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return authFetch(`/inventory/movements${q}`);
  },
  getProductStock: (id: number) => authFetch(`/inventory/products/${id}`),
  createMovement: (data: object) =>
    authFetch('/inventory/movements', { method: 'POST', body: JSON.stringify(data) }),

  // Kiểm hàng
  getStockCountStats: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return authFetch(`/inventory/stock-counts/stats${q}`);
  },
  listStockCounts: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return authFetch(`/inventory/stock-counts${q}`);
  },
  importStockCount: (items: { code: string; actualQty: number | null }[]) =>
    authFetch('/inventory/stock-counts/import', { method: 'POST', body: JSON.stringify({ items }) }),
  getStockCount: (id: number) => authFetch(`/inventory/stock-counts/${id}`),
  createStockCount: (data: { notes?: string }) =>
    authFetch('/inventory/stock-counts', { method: 'POST', body: JSON.stringify(data) }),
  addStockCountItem: (id: number, productId: number) =>
    authFetch(`/inventory/stock-counts/${id}/items`, { method: 'POST', body: JSON.stringify({ productId }) }),
  removeStockCountItem: (id: number, itemId: number) =>
    authFetch(`/inventory/stock-counts/${id}/items/${itemId}`, { method: 'DELETE' }),
  updateStockCountInfo: (id: number, data: { notes?: string | null; checkerId?: number | null; branch?: string | null; countDate?: string | null }) =>
    authFetch(`/inventory/stock-counts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateStockCountItems: (id: number, updates: { itemId: number; actualQty: number | null; reason?: string; itemNotes?: string }[]) =>
    authFetch(`/inventory/stock-counts/${id}/items`, { method: 'PATCH', body: JSON.stringify({ updates }) }),
  balanceStockCount: (id: number) =>
    authFetch(`/inventory/stock-counts/${id}/balance`, { method: 'POST', body: '{}' }),
  deleteStockCount: (id: number) =>
    authFetch(`/inventory/stock-counts/${id}`, { method: 'DELETE' }),
};
