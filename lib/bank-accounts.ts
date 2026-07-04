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

export interface BankAccount {
  id: number;
  code: string;
  loaiTaiKhoan: 'TIEN_MAT' | 'NGAN_HANG';
  tenTaiKhoan: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  branch: string | null;
  notes: string | null;
  soDuDauKy: number;
  soDuHienTai: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InternalTransfer {
  id: number;
  code: string;
  fromAccountId: number;
  fromAccountName: string | null;
  toAccountId: number;
  toAccountName: string | null;
  amount: number;
  ngay: string | null;
  dienGiai: string | null;
  createdAt: string;
}

export interface BankAccountStats {
  total: number;
  active: number;
  defaultAccount: BankAccount | null;
  totalBalance: number;
  totalTienMat: number;
  totalNganHang: number;
}

export const bankAccountsApi = {
  getAll: (activeOnly = false): Promise<BankAccount[]> =>
    authFetch(`/bank-accounts${activeOnly ? '?active=true' : ''}`),
  getStats: (): Promise<BankAccountStats> => authFetch('/bank-accounts/stats'),
  getOne: (id: number): Promise<BankAccount> => authFetch(`/bank-accounts/${id}`),
  create: (data: {
    loaiTaiKhoan: string; tenTaiKhoan?: string;
    bankName?: string; accountNumber?: string; accountHolder?: string;
    branch?: string; notes?: string; soDuDauKy?: number; isDefault?: boolean;
  }): Promise<BankAccount> =>
    authFetch('/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{
    loaiTaiKhoan: string; tenTaiKhoan: string; bankName: string; accountNumber: string;
    accountHolder: string; branch: string; notes: string; soDuDauKy: number;
    isActive: boolean; isDefault: boolean;
  }>): Promise<BankAccount> =>
    authFetch(`/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setDefault: (id: number): Promise<BankAccount> =>
    authFetch(`/bank-accounts/${id}/set-default`, { method: 'POST' }),
  delete: (id: number): Promise<void> =>
    authFetch(`/bank-accounts/${id}`, { method: 'DELETE' }),
  getTransfers: (limit = 20): Promise<InternalTransfer[]> =>
    authFetch(`/bank-accounts/chuyen-khoan?limit=${limit}`),
  createTransfer: (data: {
    fromAccountId: number; toAccountId: number; amount: number;
    ngay?: string; dienGiai?: string;
  }): Promise<InternalTransfer> =>
    authFetch('/bank-accounts/chuyen-khoan', { method: 'POST', body: JSON.stringify(data) }),
};

export const COMMON_BANKS = [
  'MB Bank', 'Vietcombank (VCB)', 'BIDV', 'Vietinbank', 'Agribank',
  'Techcombank', 'ACB', 'Sacombank', 'HDBank', 'VPBank',
  'TPBank', 'MSB', 'OCB', 'SeABank', 'Eximbank', 'Khác',
];

const BANK_VIETQR_ID: Record<string, string> = {
  'MB Bank': '970422',
  'Vietcombank (VCB)': '970436',
  'BIDV': '970418',
  'Vietinbank': '970415',
  'Agribank': '970405',
  'Techcombank': '970407',
  'ACB': '970416',
  'Sacombank': '970403',
  'HDBank': '970437',
  'VPBank': '970432',
  'TPBank': '970423',
  'MSB': '970426',
  'OCB': '970448',
  'SeABank': '970440',
  'Eximbank': '970431',
};

export function getBankVietQRId(bankName: string): string | null {
  return BANK_VIETQR_ID[bankName] ?? null;
}

export function displayName(ba: BankAccount): string {
  if (ba.tenTaiKhoan) return ba.tenTaiKhoan;
  if (ba.loaiTaiKhoan === 'TIEN_MAT') return `Tiền mặt (${ba.code})`;
  return [ba.bankName, ba.accountNumber].filter(Boolean).join(' – ') || ba.code;
}

export function fmtVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}
