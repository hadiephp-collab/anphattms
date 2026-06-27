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

export const congNoApi = {
  // Tổng quan
  getOverview: () => authFetch('/cong-no-kh/overview'),

  // Phải Thu (KH)
  getPhaiThuStats: () => authFetch('/cong-no-kh/stats'),
  getPhaiThu: (params?: Record<string, string>) =>
    authFetch(`/cong-no-kh${params ? '?' + new URLSearchParams(params) : ''}`),
  getPhaiThuDetail: (partnerId: number) => authFetch(`/cong-no-kh/${partnerId}`),

  // Phải Trả (NCC + VC)
  getPhaiTraStats: () => authFetch('/cong-no-kh/phai-tra/stats'),
  getPhaiTra: (params?: Record<string, string>) =>
    authFetch(`/cong-no-kh/phai-tra${params ? '?' + new URLSearchParams(params) : ''}`),
  getPhaiTraDetail: (partnerId: number) => authFetch(`/cong-no-kh/phai-tra/${partnerId}`),
};

// backward compat
export const congNoKhApi = {
  getStats: congNoApi.getPhaiThuStats,
  getAll: congNoApi.getPhaiThu,
  getDetail: congNoApi.getPhaiThuDetail,
};
