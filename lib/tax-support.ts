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

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface MetricValues {
  vatDauRa: number;
  vatDauVao: number;
  thueGTGT: number;
  doanhThu: number;
  chiPhi: number;
}

export interface NoiBo extends MetricValues {
  kckKyTruoc: number;
  kckKyNay: number;
  soHoaDonDauRa: number;
  soHoaDonDauVao: number;
  soPhieuChi: number;
}

export interface XuLyData {
  vatDauRa: string;
  vatDauVao: string;
  thueGTGT: string;
  doanhThu: string;
  chiPhi: string;
}

export interface TaxDoiSoat {
  id: number;
  ky: number;
  nam: number;
  noiBoData: (MetricValues & { kckKyTruoc: number; kckKyNay: number }) | null;
  keNgoaiData: MetricValues | null;
  chenhLechData: MetricValues | null;
  xuLyData: XuLyData | null;
  ghiChuData: Record<string, string | null> | null;
  trangThai: string;
  exportHistory: { exportedAt: string; exportedBy: string | null; tabCounts: { tab1: number; tab2: number; tab3: number } }[] | null;
  soLanSua: number;
  nguoiTao: string | null;
  nguoiCapNhat: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxDoiSoatLog {
  id: number;
  ky: number;
  nam: number;
  action: string;
  actor: string | null;
  snapshotJson: unknown | null;
  chiTiet: string | null;
  createdAt: string;
}

export interface QuarterSummary {
  ky: number;
  nam: number;
  vatDauRa: number;
  vatDauVao: number;
  doanhThu: number;
  chiPhi: number;
  soHoaDonDauRa: number;
  soHoaDonDauVao: number;
  soPhieuChi: number;
  doiSoat: { id: number; trangThai: string; updatedAt: string } | null;
}

// Tab 1 — HĐ VAT đầu ra
export interface Tab1Row {
  maPhieu: string;
  ngay: string;
  kyHieu: string;
  soHD: string;
  mst: string;
  tenKhachHang: string;
  tenHang: string;
  dvt: string;
  soLuong: number;
  donGia: number;
  thueSuat: number;
  tienThue: number;
  tongTien: number;
}

// Tab 2 — HĐ VAT đầu vào
export interface Tab2Row {
  maPhieu: string;
  ngay: string;
  kyHieu: string;
  soHD: string;
  mst: string;
  tenNCC: string;
  tenHang: string;
  dvt: string;
  soLuong: number;
  donGia: number;
  thueSuat: number;
  tienThue: number;
  tongTien: number;
}

// Tab 3 — Chi phí TNDN được trừ
export interface Tab3Row {
  maPhieu: string;
  ngay: string;
  nhomChi: string;
  dienGiai: string;
  soTien: number;
  pttt: string;
}

// Tab 4 — Tổng hợp quý
export interface Tab4Summary {
  ky: number;
  nam: number;
  vatDauRa: number;
  vatDauVao: number;
  kckKyTruoc: number;
  kckKyNay: number;
  thueGTGT: number;
  doanhThu: number;
  chiPhi: number;
  loiNhuanUocTinh: number;
  soHoaDonDauRa: number;
  soHoaDonDauVao: number;
  soPhieuChi: number;
  tongVatDauRaItems: number;
  tongVatDauVaoItems: number;
  tongDoanhThuItems: number;
  tongChiPhiItems: number;
}

export interface ExportData {
  tab1: Tab1Row[];
  tab2: Tab2Row[];
  tab3: Tab3Row[];
  tab4: Tab4Summary;
  ky: number;
  nam: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const taxSupportApi = {
  // Tóm tắt 4 quý trong năm
  getQuarterSummary: (nam: number): Promise<QuarterSummary[]> =>
    authFetch(`/tax-support/summary?nam=${nam}`),

  // Số liệu nội bộ real-time cho 1 quý
  getNoiBo: (ky: number, nam: number): Promise<NoiBo> =>
    authFetch(`/tax-support/noi-bo?ky=${ky}&nam=${nam}`),

  // Dữ liệu xuất Excel 4 tab
  getExportData: (ky: number, nam: number): Promise<ExportData> =>
    authFetch(`/tax-support/export-data?ky=${ky}&nam=${nam}`),

  // Đối soát
  getDoiSoat: (ky: number, nam: number): Promise<TaxDoiSoat | null> =>
    authFetch(`/tax-support/doi-soat?ky=${ky}&nam=${nam}`).catch(() => null),

  saveDoiSoat: (data: {
    ky: number;
    nam: number;
    keNgoaiData?: Partial<MetricValues>;
    ghiChuData?: Partial<Record<keyof MetricValues, string | null>>;
    actor?: string;
  }): Promise<TaxDoiSoat> =>
    authFetch('/tax-support/doi-soat', { method: 'POST', body: JSON.stringify(data) }),

  updateXuLyLech: (id: number, data: {
    xuLyData?: Partial<XuLyData>;
    ghiChuData?: Partial<Record<keyof MetricValues, string | null>>;
    actor?: string;
  }): Promise<TaxDoiSoat> =>
    authFetch(`/tax-support/doi-soat/${id}/xu-ly-lech`, { method: 'PUT', body: JSON.stringify(data) }),

  // Lịch sử
  getDoiSoatLog: (ky: number, nam: number): Promise<TaxDoiSoatLog[]> =>
    authFetch(`/tax-support/doi-soat/log?ky=${ky}&nam=${nam}`),

  getAllHistory: (nam: number): Promise<TaxDoiSoatLog[]> =>
    authFetch(`/tax-support/history?nam=${nam}`),

  // Ghi nhận xuất Excel
  recordExport: (ky: number, nam: number, tabCounts: { tab1: number; tab2: number; tab3: number }): Promise<void> =>
    authFetch('/tax-support/record-export', {
      method: 'POST',
      body: JSON.stringify({ ky, nam, tabCounts }),
    }),
};

// ── Excel Generation ──────────────────────────────────────────────────────────

const PM_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  momo: 'MoMo',
  other: 'Khác',
};

export async function generateExcel(data: ExportData): Promise<void> {
  const XLSX = await import('xlsx');
  const { tab1, tab2, tab3, tab4 } = data;
  const kyLabel = `Q${data.ky}/${data.nam}`;

  const wb = XLSX.utils.book_new();

  // ── Tab 1: HĐ VAT Đầu Ra ──────────────────────────────────────────────────
  const ws1Data = [
    ['Mã Phiếu', 'Ngày', 'Ký Hiệu HĐ', 'Số HĐ', 'MST Khách Hàng', 'Tên Khách Hàng', 'Tên Hàng/Dịch Vụ', 'ĐVT', 'Số Lượng', 'Đơn Giá', 'Thuế Suất (%)', 'Tiền Thuế', 'Tổng Tiền'],
    ...tab1.map(r => [r.maPhieu, r.ngay, r.kyHieu, r.soHD, r.mst, r.tenKhachHang, r.tenHang, r.dvt, r.soLuong, r.donGia, r.thueSuat, r.tienThue, r.tongTien]),
    [],
    ['', '', '', '', '', '', '', '', '', 'TỔNG', '', tab1.reduce((s, r) => s + Number(r.tienThue), 0), tab1.reduce((s, r) => s + Number(r.tongTien), 0)],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  ws1['!cols'] = [12, 12, 12, 12, 16, 24, 28, 8, 8, 14, 10, 14, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, 'HĐ VAT Đầu Ra');

  // ── Tab 2: HĐ VAT Đầu Vào ────────────────────────────────────────────────
  const ws2Data = [
    ['Mã Phiếu', 'Ngày', 'Ký Hiệu HĐ', 'Số HĐ', 'MST NCC', 'Tên NCC', 'Tên Hàng Hóa', 'ĐVT', 'Số Lượng', 'Đơn Giá', 'Thuế Suất (%)', 'Tiền Thuế', 'Tổng Tiền'],
    ...tab2.map(r => [r.maPhieu, r.ngay, r.kyHieu, r.soHD, r.mst, r.tenNCC, r.tenHang, r.dvt, r.soLuong, r.donGia, r.thueSuat, r.tienThue, r.tongTien]),
    [],
    ['', '', '', '', '', '', '', '', '', 'TỔNG', '', tab2.reduce((s, r) => s + Number(r.tienThue), 0), tab2.reduce((s, r) => s + Number(r.tongTien), 0)],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2['!cols'] = [12, 12, 12, 12, 16, 24, 28, 8, 8, 14, 10, 14, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws2, 'HĐ VAT Đầu Vào');

  // ── Tab 3: Chi Phí TNDN Được Trừ ────────────────────────────────────────
  const ws3Data = [
    ['Mã Phiếu', 'Ngày', 'Nhóm Chi', 'Diễn Giải', 'Số Tiền', 'PTTT'],
    ...tab3.map(r => [r.maPhieu, r.ngay, r.nhomChi, r.dienGiai, r.soTien, PM_LABEL[r.pttt] || r.pttt]),
    [],
    ['', '', '', 'TỔNG', tab3.reduce((s, r) => s + Number(r.soTien), 0), ''],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
  ws3['!cols'] = [14, 12, 20, 32, 16, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws3, 'Chi Phí TNDN');

  // ── Tab 4: Tổng Hợp Quý ──────────────────────────────────────────────────
  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
  const ws4Data = [
    [`BÁO CÁO TỔNG HỢP THUẾ — ${kyLabel}`],
    [],
    ['CHỈ TIÊU', 'Nội Bộ (VNĐ)', 'Ghi Chú'],
    ['VAT Đầu Ra (Output VAT)',         fmt(tab4.vatDauRa),          `Từ ${tab4.soHoaDonDauRa} hóa đơn xuất`],
    ['VAT Đầu Vào (Input VAT)',          fmt(tab4.vatDauVao),         `Từ ${tab4.soHoaDonDauVao} hóa đơn nhập`],
    ['KCK Kỳ Trước (Carry-forward)',     fmt(tab4.kckKyTruoc),        'Khấu trừ chuyển từ kỳ trước'],
    ['Thuế GTGT Phải Nộp',               fmt(tab4.thueGTGT),          'Max(0, VAT Ra - VAT Vào - KCK)'],
    ['KCK Kỳ Này (sang kỳ sau)',         fmt(tab4.kckKyNay),          'Nếu VAT Vào > VAT Ra'],
    [],
    ['Doanh Thu (TNDN)',                  fmt(tab4.doanhThu),          `Tổng tiền hàng từ ${tab4.soHoaDonDauRa} HĐ`],
    ['Chi Phí Được Trừ (TNDN)',           fmt(tab4.chiPhi),            `Từ ${tab4.soPhieuChi} phiếu chi hợp lệ`],
    ['Lợi Nhuận Ước Tính',               fmt(tab4.loiNhuanUocTinh),   'Doanh thu - Chi phí được trừ'],
    [],
    ['Xuất bởi An Phát TMS', '', new Date().toLocaleDateString('vi-VN')],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(ws4Data);
  ws4['!cols'] = [36, 20, 40].map(w => ({ wch: w }));
  ws4['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Tổng Hợp Quý');

  XLSX.writeFile(wb, `BCKTT_Q${data.ky}_${data.nam}.xlsx`);
}
