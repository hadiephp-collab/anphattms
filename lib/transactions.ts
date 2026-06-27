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

export const transactionsApi = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return authFetch(`/transactions${q}`);
  },
  getStats: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return authFetch(`/transactions/stats${q}`);
  },
  getCategories: () => authFetch('/transactions/categories'),
  getOne: (id: number) => authFetch(`/transactions/${id}`),
  create: (data: object) => authFetch('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: object) => authFetch(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => authFetch(`/transactions/${id}`, { method: 'DELETE' }),
  restore: (id: number) => authFetch(`/transactions/${id}/restore`, { method: 'PATCH' }),
  getPartnerSummary: (partnerId: number) =>
    authFetch(`/transactions/partner-summary?partnerId=${partnerId}`),
};

export const transactionGroupsApi = {
  getAll: (type?: 'receipt' | 'payment') => {
    const q = type ? `?type=${type}` : '';
    return authFetch(`/transaction-groups${q}`);
  },
  getOne: (id: number) => authFetch(`/transaction-groups/${id}`),
  create: (data: object) => authFetch('/transaction-groups', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: object) => authFetch(`/transaction-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleActive: (id: number) => authFetch(`/transaction-groups/${id}/toggle-active`, { method: 'PATCH' }),
  remove: (id: number) => authFetch(`/transaction-groups/${id}`, { method: 'DELETE' }),
};

export const branchesApi = {
  getAll: () => authFetch('/branches?limit=100&isActive=true'),
};

export const partnersApi = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return authFetch(`/partners${q}`);
  },
};

export const PM_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  momo: 'MoMo',
  other: 'Khác',
};
