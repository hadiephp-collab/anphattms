import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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
  if (!res.ok) throw Object.assign(new Error(data.message || 'Lỗi server'), { status: res.status, data });
  return data as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type CarrierType = 'b2b' | 'cod' | 'both';
export type ShipmentType = 'b2b' | 'cod';
export type ShipmentStatus = 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'returned' | 'cancelled';

export interface ShippingCarrier {
  id: number;
  code: string;
  name: string;
  type: CarrierType;
  description: string | null;
  contactPhone: string | null;
  isActive: boolean;
  shipmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Shipment {
  id: number;
  code: string;
  orderId: number | null;
  orderCode: string | null;
  carrierId: number;
  carrierName: string;
  type: ShipmentType;
  trackingCode: string | null;
  status: ShipmentStatus;
  codAmount: number | null;
  shippingFee: number;
  receiverName: string;
  receiverPhone: string | null;
  receiverAddress: string | null;
  scheduledDate: string | null;
  deliveredDate: string | null;
  notes: string | null;
  createdById: number | null;
  createdByName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentKpi {
  tong: number;
  dangGiao: number;
  daGiao: number;
  hoanHang: number;
  tongCOD: number;
}

export interface ShipmentListResult {
  data: Shipment[];
  total: number;
  page: number;
  limit: number;
  kpi: ShipmentKpi;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const shippingApi = {
  // Carriers
  getCarriers: (onlyActive = false) =>
    authFetch<ShippingCarrier[]>(`/shipping/carriers?active=${onlyActive}`),

  createCarrier: (data: { name: string; type?: CarrierType; description?: string; contactPhone?: string }) =>
    authFetch<ShippingCarrier>('/shipping/carriers', { method: 'POST', body: JSON.stringify(data) }),

  updateCarrier: (id: number, data: Partial<{ name: string; type: CarrierType; description: string; contactPhone: string; isActive: boolean }>) =>
    authFetch<ShippingCarrier>(`/shipping/carriers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCarrier: (id: number) =>
    authFetch<{ message: string }>(`/shipping/carriers/${id}`, { method: 'DELETE' }),

  // Shipments
  getShipments: (params?: Record<string, string>) =>
    authFetch<ShipmentListResult>(`/shipping/shipments${params ? '?' + new URLSearchParams(params) : ''}`),

  getShipment: (id: number) =>
    authFetch<Shipment>(`/shipping/shipments/${id}`),

  createShipment: (data: {
    carrierId: number;
    type?: ShipmentType;
    orderId?: number;
    trackingCode?: string;
    codAmount?: number;
    shippingFee?: number;
    receiverName: string;
    receiverPhone?: string;
    receiverAddress?: string;
    scheduledDate?: string;
    notes?: string;
  }) =>
    authFetch<Shipment>('/shipping/shipments', { method: 'POST', body: JSON.stringify(data) }),

  updateShipment: (id: number, data: Partial<{
    carrierId: number;
    trackingCode: string;
    codAmount: number;
    shippingFee: number;
    receiverName: string;
    receiverPhone: string;
    receiverAddress: string;
    scheduledDate: string;
    deliveredDate: string;
    notes: string;
  }>) =>
    authFetch<Shipment>(`/shipping/shipments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updateStatus: (id: number, status: ShipmentStatus) =>
    authFetch<Shipment>(`/shipping/shipments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deleteShipment: (id: number) =>
    authFetch<{ message: string }>(`/shipping/shipments/${id}`, { method: 'DELETE' }),
};
