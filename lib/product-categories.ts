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

export interface ProductCategory {
  id: number; name: string; code?: string; notes?: string;
  isActive: boolean; createdAt: string; updatedAt: string;
}

export const productCategoriesApi = {
  getAll: (search?: string): Promise<ProductCategory[]> =>
    authFetch(`/product-categories${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  getNames: (): Promise<string[]> =>
    authFetch('/product-categories/names'),

  getOne: (id: number): Promise<ProductCategory> =>
    authFetch(`/product-categories/${id}`),

  create: (data: { name: string; code?: string; notes?: string }): Promise<ProductCategory> =>
    authFetch('/product-categories', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Partial<ProductCategory>): Promise<ProductCategory> =>
    authFetch(`/product-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: number): Promise<{ success: boolean }> =>
    authFetch(`/product-categories/${id}`, { method: 'DELETE' }),
};
