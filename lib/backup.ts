import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Lỗi server');
  return data;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  storagePath: string;
  lastRun: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
}

export interface BackupLog {
  id: number;
  filename: string;
  filepath: string | null;
  sizeBytes: number;
  triggerType: string;
  status: string;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface BackupLogsResult {
  data: BackupLog[];
  total: number;
  page: number;
  size: number;
}

export interface CheckEnvResult {
  pgDumpPath: string;
  pgDumpVersion: string;
  storagePath: string;
  storagePathExists: boolean;
}

export const backupApi = {
  getConfig: (): Promise<BackupConfig> => authFetch('/backup/config'),

  updateConfig: (data: Partial<Pick<BackupConfig, 'enabled' | 'schedule' | 'retentionDays' | 'storagePath'>>): Promise<BackupConfig> =>
    authFetch('/backup/config', { method: 'PATCH', body: JSON.stringify({
      backupEnabled: data.enabled,
      backupSchedule: data.schedule,
      backupRetentionDays: data.retentionDays,
      backupStoragePath: data.storagePath,
    }) }),

  run: (): Promise<{ message: string; estimatedTime: string }> =>
    authFetch('/backup/run', { method: 'POST' }),

  getLogs: (page = 1, size = 20): Promise<BackupLogsResult> =>
    authFetch(`/backup/logs?page=${page}&size=${size}`),

  deleteLog: (id: number): Promise<{ message: string }> =>
    authFetch(`/backup/logs/${id}`, { method: 'DELETE' }),

  downloadFile: async (id: number, filename: string): Promise<void> => {
    const token = getToken();
    const res = await fetch(`${API}/backup/logs/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Không thể tải file');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  checkEnv: (): Promise<CheckEnvResult> => authFetch('/backup/check-env'),
};
