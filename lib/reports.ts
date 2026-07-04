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

export interface ReportSummary {
  tongDoanhThu: number;
  soDon: number;
  soKhachHang: number;
  tongThu: number;
  tongChi: number;
  luuChuyenTienTe: number;
  tongNhapHang: number;
  tongPhaiThu: number;
  tongPhaiTra: number;
  viTheRong: number;
  spSapHet: number;
  spHetHang: number;
  giaTriTonKho: number;
  topProducts: { tenSanPham: string; maSanPham: string; soLuong: number; doanhThu: number }[];
  topPartners: { tenKhachHang: string; maKhachHang: string; soDon: number; doanhThu: number }[];
  lowStockItems: { code: string; name: string; stockQuantity: number; lowStockThreshold: number }[];
}

export interface MonthlyPoint {
  month: number;
  revenue: number;
  orderCount: number;
}

export interface SalesReportKpi {
  soDon: number;
  doanhThu: number;
  doanhThuTrungBinh: number;
  soDonPrev: number;
  doanhThuPrev: number;
  trendSoDon: number;
  trendDoanhThu: number;
}

export interface SalesSeriesPoint {
  period: string;
  soDon: number;
  doanhThu: number;
}

export interface SalesTopProduct {
  productCode: string;
  productName: string;
  category: string;
  tongSoLuong: number;
  doanhThu: number;
}

export interface SalesByEmployee {
  employeeId: number | null;
  employeeName: string;
  employeeCode: string;
  soDon: number;
  doanhThu: number;
}

export interface SalesByCustomer {
  customerId: number | null;
  customerName: string;
  customerCode: string;
  soDon: number;
  doanhThu: number;
}

export interface SalesReport {
  period: { from: string; to: string; groupBy: string };
  kpi: SalesReportKpi;
  series: SalesSeriesPoint[];
  topProducts: SalesTopProduct[];
  byCategory: { category: string; doanhThu: number; tongSoLuong: number }[];
  byPaymentMethod: { paymentMethod: string; soLanThanhToan: number; tongThanhToan: number }[];
  byEmployee: SalesByEmployee[];
  byCustomer: SalesByCustomer[];
  returnsKpi: { soPhieuTra: number; tongHoanTien: number };
}

export interface InventoryItem {
  code: string;
  name: string;
  category: string;
  soLuong: number;
  giaVon: number;
  giaTriTon: number;
  lowStockThreshold: number | null;
  trangThai: 'ok' | 'sapHet' | 'hetHang';
}

export interface InventorySapHetItem extends InventoryItem {
  canThiem: number | null;
}

export interface InventoryReport {
  mode: 'system' | 'branch';
  branchId: number | null;
  branchName: string | null;
  kpi: {
    tongSKU: number;
    tongGiaTri: number;
    hetHangCount: number;
    sapHetCount: number;
  };
  topGiaTri: InventoryItem[];
  theoDanhMuc: { category: string; soSKU: number; giaTriTon: number }[];
  hetHang: InventoryItem[];
  sapHet: InventorySapHetItem[];
  allCategories: string[];
  availableBranches: { id: number; name: string }[];
  calculatedAt: string;
}

async function authPost(path: string, body: object) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Lỗi server');
  return data;
}

export const reportsApi = {
  getSummary: (dateFrom: string, dateTo: string, branchId?: number): Promise<ReportSummary> => {
    const q = new URLSearchParams({ dateFrom, dateTo });
    if (branchId) q.set('branchId', String(branchId));
    return authFetch(`/reports/summary?${q}`);
  },

  getSalesReport: (
    from: string,
    to: string,
    groupBy: 'day' | 'week' | 'month',
    branchId?: number,
  ): Promise<SalesReport> => {
    const q = new URLSearchParams({ from, to, groupBy });
    if (branchId) q.set('branchId', String(branchId));
    return authFetch(`/reports/sales?${q}`);
  },

  getMonthlyTrend: (year: number, branchId?: number): Promise<MonthlyPoint[]> => {
    const q = new URLSearchParams({ year: String(year) });
    if (branchId) q.set('branchId', String(branchId));
    return authFetch(`/reports/monthly-trend?${q}`);
  },

  getInventoryReport: (params: {
    mode: 'system' | 'branch';
    branchId?: number;
    category?: string;
    lowStockOnly?: boolean;
  }): Promise<InventoryReport> => {
    const q = new URLSearchParams({ mode: params.mode });
    if (params.branchId) q.set('branchId', String(params.branchId));
    if (params.category) q.set('category', params.category);
    if (params.lowStockOnly) q.set('lowStockOnly', 'true');
    return authFetch(`/reports/inventory?${q}`);
  },

  getProfitReport: (params: {
    loaiKy: string; thang?: number; quy?: number; nam: number;
    tuNgay?: string; denNgay?: string; branchId?: number;
  }) => {
    const q = new URLSearchParams({ loaiKy: params.loaiKy, nam: String(params.nam) });
    if (params.thang) q.set('thang', String(params.thang));
    if (params.quy) q.set('quy', String(params.quy));
    if (params.tuNgay) q.set('tuNgay', params.tuNgay);
    if (params.denNgay) q.set('denNgay', params.denNgay);
    if (params.branchId) q.set('branchId', String(params.branchId));
    return authFetch(`/reports/profit?${q}`);
  },

  getProfitByProduct: (params: {
    tuNgay: string; denNgay: string; page?: number; pageSize?: number;
    sortBy?: string; sortOrder?: string; category?: string;
  }) => {
    const q = new URLSearchParams({ tuNgay: params.tuNgay, denNgay: params.denNgay });
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortOrder) q.set('sortOrder', params.sortOrder);
    if (params.category) q.set('category', params.category);
    return authFetch(`/reports/profit/by-product?${q}`);
  },
};

export const profitApi = {
  getTaxRates: () => authFetch('/profit/tax-rates'),

  addTaxRate: (data: { effectiveDate: string; rate: number; notes?: string }) =>
    authFetch('/profit/tax-rates', {
      method: 'POST', body: JSON.stringify(data),
    }),

  getVatSummary: (nam: number) => authFetch(`/profit/vat-summary?nam=${nam}`),

  saveVatDeclaration: (data: { ky: number; nam: number; soTien: number; ngayNop: string; dienGiai?: string }) =>
    authFetch('/profit/vat-declarations', {
      method: 'POST', body: JSON.stringify(data),
    }),
};
