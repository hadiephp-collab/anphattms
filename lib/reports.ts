import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch(path: string) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
};
