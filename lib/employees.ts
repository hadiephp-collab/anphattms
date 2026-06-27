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

export const employeesApi = {
  getAll:    (params?: Record<string, string>) =>
    authFetch(`/employees${params ? '?' + new URLSearchParams(params) : ''}`),
  getStats:  () => authFetch('/employees/stats'),
  getDepartments: () => authFetch('/employees/departments'),
  getWithAccount: () => authFetch('/employees/with-account'),
  getOne:    (id: number) => authFetch(`/employees/${id}`),
  create:    (data: object) => authFetch('/employees', { method: 'POST', body: JSON.stringify(data) }),
  update:    (id: number, data: object) =>
    authFetch(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove:    (id: number) => authFetch(`/employees/${id}`, { method: 'DELETE' }),

  createAccount: (id: number, data: object) =>
    authFetch(`/employees/${id}/account`, { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: number, data: object) =>
    authFetch(`/employees/${id}/account`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeAccount: (id: number) =>
    authFetch(`/employees/${id}/account`, { method: 'DELETE' }),
  toggleAccount: (id: number) =>
    authFetch(`/employees/${id}/account/toggle`, { method: 'PATCH' }),
  updateUserBranches: (userId: number, branchIds: number[]) =>
    authFetch(`/users/${userId}/branches`, { method: 'PUT', body: JSON.stringify({ branchIds }) }),
};
