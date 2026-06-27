'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { vatPurchaseInvoiceApi } from '@/lib/vat-purchase-invoices';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

interface Stats {
  totalConfirmed: number; totalDraft: number; totalCancelled: number;
  tongVatVao: number; tongDoanhSoNhap: number; overdueDraft: number; pendingPOs: number;
}
interface InvoiceRow {
  id: number; code: string; kyHieu: string; soHD: string; ngayHoaDon: string;
  supplierName: string | null; maSoThue: string | null;
  purchaseOrderId: number | null; purchaseOrderCode: string | null;
  tongTienHang: number; tongTienThue: number; tongCong: number;
  trangThai: string; soLuongDong: number; overdueWarning: boolean;
  createdByName: string | null; createdAt: string;
}
interface MonthlySummaryRow {
  thang: string; soPhieu: number;
  tongTienHang: number; tongTienThue: number; tongCong: number;
}
interface PendingPORow {
  id: number; code: string; supplierId: number | null; supplierName: string | null;
  totalAmountVnd: number; receivedDate: string | null; createdAt: string;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft:     { text: 'Nháp',         cls: 'bg-yellow-100 text-yellow-700' },
  confirmed: { text: 'Đã ghi nhận',  cls: 'bg-green-100 text-green-700' },
  cancelled: { text: 'Đã huỷ',       cls: 'bg-gray-100 text-gray-500' },
};

export default function NhapHdVatPage() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [tab, setTab]       = useState<'phieu' | 'cho-nhap' | 'tong-hop'>('phieu');
  const [year, setYear]     = useState(new Date().getFullYear());

  // Tab phiếu
  const [data, setData]         = useState<InvoiceRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState('');
  const [search, setSearch]     = useState('');
  const limit = 20;

  // Tab tổng hợp
  const [summary, setSummary]   = useState<MonthlySummaryRow[]>([]);
  const [sumLoading, setSumLoading] = useState(false);

  // Tab chờ nhập HĐ
  const [pendingPOs, setPendingPOs]       = useState<PendingPORow[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  useEffect(() => {
    vatPurchaseInvoiceApi.getStats().then(setStats).catch(() => {});
  }, []);

  const loadPhieu = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = { page: String(page), limit: String(limit) };
      if (status) p.trangThai = status;
      if (search) p.search    = search;
      const res = await vatPurchaseInvoiceApi.getList(p);
      setData(res.data); setTotal(res.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, status, search]);

  const loadSummary = useCallback(async () => {
    setSumLoading(true);
    try {
      const res = await vatPurchaseInvoiceApi.getMonthlySummary(year);
      setSummary(res);
    } catch { /* ignore */ }
    setSumLoading(false);
  }, [year]);

  const loadPendingPOs = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await vatPurchaseInvoiceApi.getPendingPOs();
      setPendingPOs(res);
    } catch { /* ignore */ }
    setPendingLoading(false);
  }, []);

  useEffect(() => { if (tab === 'phieu')    loadPhieu();    }, [tab, loadPhieu]);
  useEffect(() => { if (tab === 'tong-hop') loadSummary();  }, [tab, loadSummary]);
  useEffect(() => { if (tab === 'cho-nhap') loadPendingPOs(); }, [tab, loadPendingPOs]);

  const kpiCards = [
    { label: 'Đã ghi nhận',        value: stats?.totalConfirmed  ?? 0,  unit: 'phiếu', color: 'from-green-500 to-green-600',  isCount: true },
    { label: 'VATvao được KT',     value: stats?.tongVatVao      ?? 0,  color: 'from-blue-500 to-blue-600' },
    { label: 'Tổng doanh số NK',   value: stats?.tongDoanhSoNhap ?? 0,  color: 'from-purple-500 to-purple-600' },
    { label: 'Đơn chờ nhập HĐ',   value: stats?.pendingPOs      ?? 0,  unit: 'đơn',   color: 'from-orange-500 to-orange-600', isCount: true },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Nhập Hóa Đơn VAT</h2>
          <p className="text-sm text-gray-500">Hóa đơn VAT đầu vào (NK-) · Tính VATvao khấu trừ thuế GTGT</p>
        </div>
        <Link href="/dashboard/nhap-hd-vat/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
          + Tạo phiếu nhập
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {kpiCards.map(k => (
          <div key={k.label} className={`rounded-xl p-4 bg-gradient-to-br ${k.color} text-white`}>
            <p className="text-xs font-medium opacity-80">{k.label}</p>
            <p className="text-lg font-bold mt-1">{k.isCount ? k.value : VND(k.value)}</p>
            {k.unit && <p className="text-xs opacity-70 mt-1">{k.unit}</p>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b flex">
          <button onClick={() => setTab('phieu')}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'phieu' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Phiếu Nhập HĐ
          </button>
          <button onClick={() => setTab('cho-nhap')}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'cho-nhap' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Đơn Chờ Nhập HĐ
            {(stats?.pendingPOs ?? 0) > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {stats!.pendingPOs}
              </span>
            )}
          </button>
          <button onClick={() => setTab('tong-hop')}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'tong-hop' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Tổng hợp VATvao
          </button>
        </div>

        {/* ── Tab Phiếu ── */}
        {tab === 'phieu' && (
          <>
            <div className="p-4 border-b flex flex-wrap gap-2 items-center">
              {/* Status filter */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
                {([['', 'Tất cả'], ['draft', 'Nháp'], ['confirmed', 'Đã ghi nhận'], ['cancelled', 'Đã huỷ']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => { setStatus(k); setPage(1); }}
                    className={`px-3 py-1.5 ${status === k ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{l}</button>
                ))}
              </div>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Tìm mã phiếu, số HĐ, NCC..."
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <span className="text-sm text-gray-400 ml-auto">{total} phiếu</span>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Mã phiếu</th>
                  <th className="px-4 py-3 text-left">Ký hiệu / Số HĐ</th>
                  <th className="px-4 py-3 text-left">Ngày HĐ</th>
                  <th className="px-4 py-3 text-left">Nhà cung cấp</th>
                  <th className="px-4 py-3 text-left">Đơn nhập</th>
                  <th className="px-4 py-3 text-right">Tiền hàng</th>
                  <th className="px-4 py-3 text-right">VATvao</th>
                  <th className="px-4 py-3 text-right">Tổng cộng</th>
                  <th className="px-4 py-3 text-center">TT</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Đang tải...</td></tr>
                  : data.length === 0
                  ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Chưa có phiếu nào</td></tr>
                  : data.map(row => {
                    const badge = STATUS_LABEL[row.trangThai] ?? { text: row.trangThai, cls: 'bg-gray-100 text-gray-500' };
                    return (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-blue-600">{row.code}</span>
                          {row.overdueWarning && (
                            <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full" title="Nháp quá 30 ngày, cần kê khai">⚠ Quá hạn</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.kyHieu}</p>
                          <p className="text-xs text-gray-400">{row.soHD}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{row.ngayHoaDon}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.supplierName || '—'}</p>
                          <p className="text-xs text-gray-400">{row.maSoThue || ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          {row.purchaseOrderCode
                            ? <Link href={`/dashboard/don-hang-nhap/${row.purchaseOrderId}`}
                                className="text-blue-600 hover:underline text-xs">{row.purchaseOrderCode}</Link>
                            : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{VND(row.tongTienHang)}</td>
                        <td className="px-4 py-3 text-right text-orange-600 font-medium">{VND(row.tongTienThue)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700">{VND(row.tongCong)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.text}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/nhap-hd-vat/${row.id}`}
                            className="text-blue-600 hover:underline text-xs">Xem →</Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {total > limit && (
              <div className="p-4 border-t flex items-center justify-between text-sm text-gray-500">
                <span>{Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} / {total}</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">←</button>
                  <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">→</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab Đơn Chờ Nhập HĐ ── */}
        {tab === 'cho-nhap' && (
          <>
            <div className="p-4 border-b">
              <p className="text-sm text-gray-500">
                Đơn hàng nhập đã nhận hàng (<strong>Đã nhận</strong>) nhưng chưa có HĐ VAT đầu vào.
                Nhấn <strong>Tạo HĐ VAT</strong> để ghi nhận hóa đơn từ NCC.
              </p>
            </div>

            {pendingLoading
              ? <div className="text-center py-12 text-gray-400">Đang tải...</div>
              : pendingPOs.length === 0
              ? <div className="text-center py-12 text-gray-400">Tất cả đơn đã có HĐ VAT</div>
              : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="px-4 py-3 text-left">Mã đơn nhập</th>
                      <th className="px-4 py-3 text-left">Nhà cung cấp</th>
                      <th className="px-4 py-3 text-left">Ngày nhận hàng</th>
                      <th className="px-4 py-3 text-right">Tổng tiền đơn (VNĐ)</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPOs.map(po => (
                      <tr key={po.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/don-hang-nhap/${po.id}`}
                            className="font-semibold text-blue-600 hover:underline">
                            {po.code}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{po.supplierName || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{po.receivedDate || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {VND(po.totalAmountVnd)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/dashboard/nhap-hd-vat/new?purchaseOrderId=${po.id}`}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap">
                            + Tạo HĐ VAT
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            {pendingPOs.length > 0 && (
              <div className="p-3 border-t text-xs text-gray-400 text-right">
                {pendingPOs.length} đơn chờ nhập HĐ
              </div>
            )}
          </>
        )}

        {/* ── Tab Tổng hợp VATvao ── */}
        {tab === 'tong-hop' && (
          <>
            <div className="p-4 border-b flex items-center gap-3">
              <label className="text-sm text-gray-600">Năm:</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-sm text-gray-400 ml-auto">Chỉ tính phiếu đã ghi nhận</span>
            </div>

            {sumLoading
              ? <div className="text-center py-12 text-gray-400">Đang tải...</div>
              : summary.length === 0
              ? <div className="text-center py-12 text-gray-400">Chưa có dữ liệu năm {year}</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                        <th className="px-4 py-3 text-left">Tháng</th>
                        <th className="px-4 py-3 text-right">Số phiếu</th>
                        <th className="px-4 py-3 text-right">Tiền hàng (chưa VAT)</th>
                        <th className="px-4 py-3 text-right">VATvao</th>
                        <th className="px-4 py-3 text-right">Tổng cộng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(r => (
                        <tr key={r.thang} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{r.thang}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{r.soPhieu}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{VND(r.tongTienHang)}</td>
                          <td className="px-4 py-3 text-right text-orange-600 font-medium">{VND(r.tongTienThue)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-700">{VND(r.tongCong)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-blue-50 font-semibold text-sm">
                        <td className="px-4 py-3 text-blue-800">Tổng cả năm {year}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{summary.reduce((s, r) => s + r.soPhieu, 0)}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{VND(summary.reduce((s, r) => s + r.tongTienHang, 0))}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{VND(summary.reduce((s, r) => s + r.tongTienThue, 0))}</td>
                        <td className="px-4 py-3 text-right text-blue-800">{VND(summary.reduce((s, r) => s + r.tongCong, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
