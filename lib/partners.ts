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

export const partnersApi = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return authFetch(`/partners${q}`);
  },
  getStats: () => authFetch('/partners/stats'),
  getProvinces: (): Promise<string[]> => authFetch('/partners/provinces'),
  getTopDebt: (limit = 10) => authFetch(`/partners/top-debt?limit=${limit}`),
  getOne: (id: number) => authFetch(`/partners/${id}`),
  create: (data: object) => authFetch('/partners', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: object) => authFetch(`/partners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => authFetch(`/partners/${id}`, { method: 'DELETE' }),
  import: (rows: object[]) => authFetch('/partners/import', { method: 'POST', body: JSON.stringify({ rows }) }),
};
