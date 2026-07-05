import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Lỗi server'), { status: res.status, data });
  return data as T;
}

export interface StoreSetting {
  id: number;
  storeName: string;
  storeAddress: string | null;
  storePhone: string | null;
  storeEmail: string | null;
  taxCode: string | null;
  website: string | null;
  logoUrl: string | null;
  printHeader: string | null;
  printFooter: string | null;
  defaultVatRate: string | null;
  invoiceWarningDays: string | null;
  warrantyAutoCreate: boolean;
  warrantyAlertEnabled: boolean;
  // Print templates
  templateHoaDon: string | null;
  templatePhieuThu: string | null;
  templatePhieuChi: string | null;
  paperSizeHoaDon: string | null;
  paperSizePhieuThu: string | null;
  paperSizePhieuChi: string | null;
  templateDonHangNhap: string | null;
  templateTraHangNcc: string | null;
  templateVanDon: string | null;
  paperSizeDonHangNhap: string | null;
  paperSizeTraHangNcc: string | null;
  paperSizeVanDon: string | null;
  // Telegram Bot
  telegramEnabled: boolean;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  telegramNotifyNewOrder: boolean;
  telegramNotifyCancelOrder: boolean;
  telegramNotifyLowStock: boolean;
  telegramNotifyDailyReport: boolean;
  telegramLowStockThreshold: number;
  updatedAt: string;
}

export interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
}

export const settingsApi = {
  get: (): Promise<StoreSetting> => authFetch('/settings'),
  update: (data: Partial<Omit<StoreSetting, 'id' | 'updatedAt'>>) =>
    authFetch('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  getPaymentMethods: (activeOnly = false): Promise<PaymentMethod[]> =>
    authFetch(`/settings/payment-methods${activeOnly ? '?active=true' : ''}`),
  createPaymentMethod: (data: { code: string; name: string; isDefault?: boolean; sortOrder?: number }) =>
    authFetch<PaymentMethod>('/settings/payment-methods', { method: 'POST', body: JSON.stringify(data) }),
  updatePaymentMethod: (id: number, data: Partial<{ name: string; isActive: boolean; isDefault: boolean; sortOrder: number }>) =>
    authFetch<PaymentMethod>(`/settings/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePaymentMethod: (id: number) =>
    authFetch(`/settings/payment-methods/${id}`, { method: 'DELETE' }),
};
