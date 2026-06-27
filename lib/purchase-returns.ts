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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return authFetch(path, init);
}

export type LoaiTraHang = 'HangLoi' | 'HangSaiSo' | 'HetHan' | 'Khac';

export const LOAI_TRA_HANG: Record<LoaiTraHang, string> = {
  HangLoi:   'Hàng Lỗi',
  HangSaiSo: 'Hàng Sai Số',
  HetHan:    'Hết Hạn',
  Khac:      'Khác',
};

export interface PurchaseReturnItem {
  id: number;
  purchaseOrderItemId: number | null;
  productId: number;
  productCode: string | null;
  productName: string;
  unit: string | null;
  quantity: number;
  priceVnd: number;
  priceForeign: number | null;
  totalVnd: number;
  reason: string | null;
}

export interface PurchaseReturn {
  id: number;
  code: string;
  purchaseOrderId: number;
  purchaseOrder: { id: number; code: string } | null;
  supplierId: number;
  supplier: { id: number; name: string; code: string } | null;
  branchId: number | null;
  branch: { id: number; name: string } | null;
  status: 'draft' | 'sent' | 'confirmed' | 'cancelled';
  loaiTraHang: LoaiTraHang | null;
  refundStatus: 'none' | 'partial' | 'full';
  refundedAmount: number;
  ptttHoan: string | null;
  ngayHoanTien: string | null;
  ngayGuiYeuCau: string | null;
  nguoiHuy: string | null;
  ngayHuy: string | null;
  returnDate: string | null;
  reason: string | null;
  ghiChuNCC: string | null;
  cancelReason: string | null;
  notes: string | null;
  totalAmountVnd: number;
  confirmedAt: string | null;
  confirmedBy: { id: number; username: string } | null;
  actorName: string | null;
  items: PurchaseReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReturnStats {
  total: number;
  pending: number;
  sent: number;
  confirmed: number;
  cancelled: number;
  totalValueVnd: number;
  byLyDo: Record<string, number>;
  topSP: { productId: number; productCode: string | null; productName: string; tongSL: number; tongGiaTri: number }[];
}

export interface PurchaseReturnListResponse {
  data: PurchaseReturn[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreatePurchaseReturnItemPayload {
  purchaseOrderItemId: number;
  quantity: number;
  reason?: string;
}

export interface CreatePurchaseReturnPayload {
  purchaseOrderId: number;
  returnDate?: string;
  loaiTraHang?: LoaiTraHang;
  reason?: string;
  ghiChuNCC?: string;
  notes?: string;
  items: CreatePurchaseReturnItemPayload[];
}

export interface UpdateRefundPayload {
  refundedAmount: number;
  pttt?: string;
  ngayHoanTien?: string;
  createPhieuThu?: boolean;
}

export function getPurchaseReturnStats(params?: { dateFrom?: string; dateTo?: string; branchId?: string }): Promise<PurchaseReturnStats> {
  const qs = params
    ? '?' + Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')
    : '';
  return request(`/purchase-returns/stats${qs}`);
}

export function getPurchaseReturns(params?: Record<string, string | number | undefined>): Promise<PurchaseReturnListResponse> {
  const qs = params
    ? '?' + Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')
    : '';
  return request(`/purchase-returns${qs}`);
}

export function getPurchaseReturn(id: number): Promise<PurchaseReturn> {
  return request(`/purchase-returns/${id}`);
}

export function createPurchaseReturn(payload: CreatePurchaseReturnPayload): Promise<PurchaseReturn> {
  return request('/purchase-returns', { method: 'POST', body: JSON.stringify(payload) });
}

export function updatePurchaseReturn(id: number, payload: Partial<CreatePurchaseReturnPayload>): Promise<PurchaseReturn> {
  return request(`/purchase-returns/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function sendPurchaseReturn(id: number): Promise<PurchaseReturn> {
  return request(`/purchase-returns/${id}/send`, { method: 'PATCH', body: '{}' });
}

export function confirmPurchaseReturn(id: number): Promise<PurchaseReturn> {
  return request(`/purchase-returns/${id}/confirm`, { method: 'PATCH', body: '{}' });
}

export function cancelPurchaseReturn(id: number, cancelReason?: string): Promise<PurchaseReturn> {
  return request(`/purchase-returns/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ cancelReason }) });
}

export function updatePurchaseReturnRefund(id: number, payload: UpdateRefundPayload): Promise<PurchaseReturn> {
  return request(`/purchase-returns/${id}/refund`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deletePurchaseReturn(id: number): Promise<void> {
  return request(`/purchase-returns/${id}`, { method: 'DELETE' });
}
