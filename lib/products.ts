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

export const productsApi = {
  getAll:       (params?: Record<string, string>) => authFetch(`/products${params ? '?' + new URLSearchParams(params) : ''}`),
  getStats:     () => authFetch('/products/stats'),
  getCategories:() => authFetch('/products/categories'),
  getOne:       (id: number) => authFetch(`/products/${id}`),
  create:       (data: object) => authFetch('/products', { method: 'POST', body: JSON.stringify(data) }),
  update:       (id: number, data: object) => authFetch(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove:       (id: number) => authFetch(`/products/${id}`, { method: 'DELETE' }),

  bulkCreateVariants: (id: number, variants: object[]) =>
    authFetch(`/products/${id}/variants/bulk`, { method: 'POST', body: JSON.stringify({ variants }) }),
  updateVariant: (id: number, varId: number, data: object) =>
    authFetch(`/products/${id}/variants/${varId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVariant: (id: number, varId: number) =>
    authFetch(`/products/${id}/variants/${varId}`, { method: 'DELETE' }),

  addImage:     (id: number, data: object) => authFetch(`/products/${id}/images`, { method: 'POST', body: JSON.stringify(data) }),
  setMainImage: (id: number, imgId: number) => authFetch(`/products/${id}/images/${imgId}/set-main`, { method: 'PATCH', body: '{}' }),
  deleteImage:  (id: number, imgId: number) => authFetch(`/products/${id}/images/${imgId}`, { method: 'DELETE' }),

  import:        (rows: object[]) => authFetch('/products/import', { method: 'POST', body: JSON.stringify({ rows }) }),

  addInvoiceName:    (id: number, data: object) => authFetch(`/products/${id}/invoice-names`, { method: 'POST', body: JSON.stringify(data) }),
  updateInvoiceName: (id: number, nameId: number, data: object) =>
    authFetch(`/products/${id}/invoice-names/${nameId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteInvoiceName: (id: number, nameId: number) =>
    authFetch(`/products/${id}/invoice-names/${nameId}`, { method: 'DELETE' }),
};
