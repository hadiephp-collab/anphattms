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

export const vatReportApi = {
  getReport: (year: number, quarter?: number) => {
    const params = new URLSearchParams({ year: String(year) });
    if (quarter) params.set('quarter', String(quarter));
    return authFetch(`/vat-report?${params}`);
  },

  getNopBoSung: () =>
    authFetch('/vat-report/nop-bo-sung'),

  saveNopBoSung: (body: { kyKey: string; ngayNop?: string; soTien?: number; dienGiai?: string }) =>
    authFetch('/vat-report/nop-bo-sung', { method: 'POST', body: JSON.stringify(body) }),
};
