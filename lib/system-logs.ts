import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Lỗi server'), { status: res.status });
  return data as T;
}

export interface LogRow {
  id: string;
  source: string;
  module: string;
  action: string;
  entityCode: string | null;
  actorName: string | null;
  details: string | null;
  createdAt: string;
}

export interface LogListResult {
  data: LogRow[];
  total: number;
  page: number;
  limit: number;
}

export const systemLogsApi = {
  getAll: (params?: Record<string, string>) =>
    authFetch<LogListResult>(`/system-logs${params ? '?' + new URLSearchParams(params) : ''}`),
  getModules: () => authFetch<string[]>('/system-logs/modules'),
};
