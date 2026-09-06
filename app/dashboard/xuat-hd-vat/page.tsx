'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { vatExportApi } from '@/lib/vat-exports';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

interface Stats {
  totalActive: number; tongDoanhThu: number; tongThue: number;
  totalVoid: number; pendingInvoiceOrders: number;
}
interface VatExportRow {
  id: number; code: string; ngayXuat: string; kyHieu: string; soHD: string;
  customerName: string; maSoThue: string; tongTienHang: number;
  tongTienThue: number; tongCong: number; trangThai: string;
  soLuongDong: number; giaBQWarning: boolean; createdByName: string; createdAt: string;
}
interface PendingOrder {
  id: number; code: string; date: string; totalAmount: number;
  status: string; invoiceStatus: string; customerName: string; customerCode: string;
}

const invoiceStatusLabel: Record<string, { text: string; cls: string }> = {
  pending_invoice: { text: 'Chờ xuất HĐ', cls: 'bg-yellow-100 text-yellow-700' },
  invoiced:        { text: 'Đã xuất HĐ', cls: 'bg-green-100 text-green-700' },
  no_invoice:      { text: 'Không xuất HĐ', cls: 'bg-gray-100 text-gray-500' },
};

export default function XuatHdVatPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'phieu' | 'cho-xuat'>('phieu');

  // --- Tab Phiếu Xuất ---
  const [phieuData, setPhieuData] = useState<VatExportRow[]>([]);
  const [phieuTotal, setPhieuTotal] = useState(0);
  const [phieuPage, setPhieuPage] = useState(1);
  const [phieuStatus, setPhieuStatus] = useState<'active' | 'void' | 'all'>('active');
  const [phieuLoading, setPhieuLoading] = useState(false);
  const limit = 20;

  // --- Tab Đơn Chờ ---
  const [pendingData, setPendingData] = useState<PendingOrder[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(false);

  useEffect(() => {
    vatExportApi.getStats().then(setStats).catch(() => {});
  }, []);

  const loadPhieu = useCallback(async () => {
    setPhieuLoading(true);
    try {
      const p: Record<string, string> = {
        page: String(phieuPage), limit: String(limit),
        trangThai: phieuStatus, sortBy: 'ngayXuat', sortOrder: 'DESC',
      };
      const res = await vatExportApi.getList(p);
      setPhieuData(res.data); setPhieuTotal(res.total);
    } catch { /* ignore */ }
    setPhieuLoading(false);
  }, [phieuPage, phieuStatus]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const p: Record<string, string> = { page: String(pendingPage), limit: String(limit) };
      const res = await vatExportApi.getPendingOrders(p);
      setPendingData(res.data); setPendingTotal(res.total);
    } catch { /* ignore */ }
    setPendingLoading(false);
  }, [pendingPage]);

  useEffect(() => { if (tab === 'phieu') loadPhieu(); }, [tab, loadPhieu]);
  useEffect(() => { if (tab === 'cho-xuat') loadPending(); }, [tab, loadPending]);

  const kpiCards = [
    { label: 'Phiếu đang hiệu lực', value: stats?.totalActive ?? 0, unit: 'phiếu', color: 'from-blue-500 to-blue-600', isCount: true },
    { label: 'Doanh thu có HĐ VAT', value: stats?.tongDoanhThu ?? 0, color: 'from-green-500 to-green-600' },
    { label: 'VAT đầu ra', value: stats?.tongThue ?? 0, color: 'from-orange-500 to-orange-600' },
    { label: 'Đơn chờ xuất HĐ', value: stats?.pendingInvoiceOrders ?? 0, unit: 'đơn', color: 'from-yellow-500 to-yellow-600', isCount: true },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Xuất Hóa Đơn VAT</h2>
          <p className="text-sm text-gray-500">Phiếu xuất XUATHANG (XK-) · giaBQ snapshot · Không xóa, chỉ Void</p>
        </div>
        <Link href="/dashboard/xuat-hd-vat/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
          + Tạo phiếu xuất
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
          {([['phieu', 'Phiếu Xuất HĐ'], ['cho-xuat', `Đơn Chờ Xuất (${stats?.pendingInvoiceOrders ?? 0})`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab Phiếu Xuất */}
        {tab === 'phieu' && (
          <>
            <div className="p-4 border-b flex gap-2 items-center">
              <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
                {([['active', 'Đang hiệu lực'], ['void', 'Đã void'], ['all', 'Tất cả']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => { setPhieuStatus(k); setPhieuPage(1); }}
                    className={`px-3 py-1.5 ${phieuStatus === k ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{l}</button>
                ))}
              </div>
              <span className="text-sm text-gray-400 ml-auto">{phieuTotal} phiếu</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Mã phiếu</th>
                  <th className="px-4 py-3 text-left">Ngày xuất</th>
                  <th className="px-4 py-3 text-left">Ký hiệu / Số HĐ</th>
                  <th className="px-4 py-3 text-left">Khách hàng</th>
                  <th className="px-4 py-3 text-right">Tiền hàng</th>
                  <th className="px-4 py-3 text-right">Tiền thuế VAT</th>
                  <th className="px-4 py-3 text-right">Tổng cộng</th>
                  <th className="px-4 py-3 text-center">TT</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {phieuLoading
                  ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">Đang tải...</td></tr>
                  : phieuData.length === 0
                  ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">Chưa có phiếu xuất nào</td></tr>
                  : phieuData.map(row => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-blue-600">{row.code}</span>
                        {row.giaBQWarning && <span className="ml-1 text-xs text-orange-500" title="Có SP chưa có giá nhập">⚠</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.ngayXuat}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.kyHieu}</p>
                        <p className="text-xs text-gray-400">{row.soHD}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.customerName || '—'}</p>
                        <p className="text-xs text-gray-400">{row.maSoThue || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{VND(row.tongTienHang)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{VND(row.tongTienThue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">{VND(row.tongCong)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${row.trangThai === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {row.trangThai === 'active' ? 'Hiệu lực' : 'Void'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/xuat-hd-vat/${row.id}`} className="text-blue-600 hover:underline text-xs">Xem →</Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {phieuTotal > limit && (
              <div className="p-4 border-t flex items-center justify-between text-sm text-gray-500">
                <span>{Math.min((phieuPage - 1) * limit + 1, phieuTotal)}–{Math.min(phieuPage * limit, phieuTotal)} / {phieuTotal}</span>
                <div className="flex gap-2">
                  <button disabled={phieuPage <= 1} onClick={() => setPhieuPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">←</button>
                  <button disabled={phieuPage * limit >= phieuTotal} onClick={() => setPhieuPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">→</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab Đơn Chờ Xuất */}
        {tab === 'cho-xuat' && (
          <>
            <div className="p-4 border-b flex items-center">
              <p className="text-sm text-gray-500">Các đơn hàng đang chờ xuất hóa đơn VAT. Bấm "Xuất HĐ" để tạo phiếu.</p>
              <span className="ml-auto text-sm text-gray-400">{pendingTotal} đơn</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Mã đơn</th>
                  <th className="px-4 py-3 text-left">Ngày đơn</th>
                  <th className="px-4 py-3 text-left">Khách hàng</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3 text-center">TT HĐ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pendingLoading
                  ? <tr><td colSpan={6} className="text-center py-12 text-gray-400">Đang tải...</td></tr>
                  : pendingData.length === 0
                  ? <tr><td colSpan={6} className="text-center py-12 text-gray-400">Không có đơn chờ xuất HĐ</td></tr>
                  : pendingData.map(row => {
                    const badge = invoiceStatusLabel[row.invoiceStatus] ?? { text: row.invoiceStatus, cls: 'bg-gray-100 text-gray-500' };
                    return (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-blue-600">{row.code}</td>
                        <td className="px-4 py-3 text-gray-600">{row.date ? String(row.date).split('T')[0] : '—'}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.customerName || '—'}</p>
                          <p className="text-xs text-gray-400">{row.customerCode}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{VND(row.totalAmount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.text}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/dashboard/xuat-hd-vat/new?orderId=${row.id}`}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                            Xuất HĐ →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {pendingTotal > limit && (
              <div className="p-4 border-t flex items-center justify-between text-sm text-gray-500">
                <span>{Math.min((pendingPage - 1) * limit + 1, pendingTotal)}–{Math.min(pendingPage * limit, pendingTotal)} / {pendingTotal}</span>
                <div className="flex gap-2">
                  <button disabled={pendingPage <= 1} onClick={() => setPendingPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">←</button>
                  <button disabled={pendingPage * limit >= pendingTotal} onClick={() => setPendingPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
