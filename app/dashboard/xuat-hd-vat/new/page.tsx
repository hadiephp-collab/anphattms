'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { vatExportApi } from '@/lib/vat-exports';

const VND_NUM = (v: number) => Math.round(v).toLocaleString('vi-VN');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

interface InvoiceNameOption { id: number; invoiceName: string; invoiceUnit?: string; isDefault: boolean; }
interface FormRow {
  productId: number;
  productCode: string;
  productName: string;
  dvt: string;
  slThucTe: number;
  slHoaDon: number;
  donGia: number;
  thueSuat: number;
  tenHoaDon: string;
  tenHoaDonList: InvoiceNameOption[];
  coLayHoaDon: boolean;
  sortOrder: number;
}

function calcRow(r: FormRow) {
  const thanhTien = r.coLayHoaDon ? Math.round(r.slHoaDon * r.donGia) : 0;
  const tienThue = Math.round(thanhTien * r.thueSuat / 100);
  return { thanhTien, tienThue, tongTien: thanhTien + tienThue };
}

function NewVatExportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get('orderId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successCode, setSuccessCode] = useState('');
  const [giaBQWarnings, setGiaBQWarnings] = useState<number[]>([]);

  // Header fields
  const [codePreview, setCodePreview] = useState('XK-...');
  const [ngayXuat, setNgayXuat] = useState(today());
  const [kyHieu, setKyHieu] = useState('');
  const [soHD, setSoHD] = useState('');
  const [notes, setNotes] = useState('');

  // Customer
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [maSoThue, setMaSoThue] = useState('');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderCode, setOrderCode] = useState('');

  // Rows
  const [rows, setRows] = useState<FormRow[]>([]);

  // Load prefill
  useEffect(() => {
    setLoading(true);
    const oid = orderIdParam ? Number(orderIdParam) : undefined;
    vatExportApi.getPrefill(oid)
      .then((res) => {
        setCodePreview(res.codePreview);
        if (res.order) {
          setCustomerId(res.order.customerId);
          setCustomerName(res.order.customerName);
          setMaSoThue(res.order.maSoThue || '');
          setOrderId(res.order.id);
          setOrderCode(res.order.code);
        }
        setRows((res.rows || []).map((r: any, idx: number) => ({
          productId: r.productId,
          productCode: r.productCode || '',
          productName: r.productName || '',
          dvt: r.dvt || '',
          slThucTe: r.slThucTe ?? r.slHoaDon ?? 0,
          slHoaDon: r.slHoaDon ?? 0,
          donGia: r.donGia ?? 0,
          thueSuat: r.thueSuat ?? 10,
          tenHoaDon: r.tenHoaDon || '',
          tenHoaDonList: r.tenHoaDonList || [],
          coLayHoaDon: true,
          sortOrder: idx,
        })));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderIdParam]);

  const updateRow = useCallback(<K extends keyof FormRow>(idx: number, key: K, val: FormRow[K]) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  }, []);

  const toggleTenHD = useCallback((idx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx || r.tenHoaDonList.length < 2) return r;
      const curIdx = r.tenHoaDonList.findIndex(n => n.invoiceName === r.tenHoaDon);
      const nextIdx = (curIdx + 1) % r.tenHoaDonList.length;
      return { ...r, tenHoaDon: r.tenHoaDonList[nextIdx].invoiceName };
    }));
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Totals
  const activeRows = rows.filter(r => r.coLayHoaDon);
  const tongTienHang = activeRows.reduce((s, r) => s + calcRow(r).thanhTien, 0);
  const tongTienThue = activeRows.reduce((s, r) => s + calcRow(r).tienThue, 0);
  const tongCong = tongTienHang + tongTienThue;
  const canSave = activeRows.length > 0
    && activeRows.every(r => r.slHoaDon > 0 && r.donGia > 0 && r.tenHoaDon.trim())
    && kyHieu.trim() && soHD.trim() && customerId && maSoThue.trim()
    && !saving;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        ngayXuat,
        kyHieu: kyHieu.trim(),
        soHD: soHD.trim(),
        customerId,
        maSoThue: maSoThue.trim(),
        orderId: orderId ?? undefined,
        notes: notes.trim() || undefined,
        rows: activeRows.map(r => ({
          productId: r.productId,
          tenHoaDon: r.tenHoaDon,
          dvt: r.dvt || undefined,
          slHoaDon: r.slHoaDon,
          donGia: r.donGia,
          thueSuat: r.thueSuat,
        })),
      };
      const res = await vatExportApi.create(payload);
      setSuccessCode(res.code);
      if (res.giaBQWarnings?.length > 0) setGiaBQWarnings(res.giaBQWarnings);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Đang tải dữ liệu...</div>
  );

  if (successCode) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 w-80 text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900">Đã lưu phiếu {successCode}</p>
        {orderId && <p className="text-sm text-gray-500">Đơn {orderCode} đã chuyển sang <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-xs font-medium">Đã xuất HĐ</span></p>}
        {giaBQWarnings.length > 0 && (
          <p className="text-sm text-orange-600 bg-orange-50 rounded-lg p-2">
            ⚠ {giaBQWarnings.length} sản phẩm chưa có giá nhập — giá vốn = 0đ trong báo cáo
          </p>
        )}
        <button onClick={() => router.push('/dashboard/xuat-hd-vat')}
          className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          Xong
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/xuat-hd-vat" className="text-gray-400 hover:text-gray-600">←</Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tạo phiếu xuất hàng hóa — HĐ VAT</h2>
          <p className="text-sm text-gray-400">Mã phiếu: <span className="text-blue-600 font-medium">{codePreview}</span> · Ghi vào XUATHANG</p>
        </div>
      </div>

      {/* Ref box (từ đơn hàng) */}
      {orderId && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Tạo từ đơn hàng <strong>{orderCode}</strong> · KH: {customerName}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Section 1: Thông tin HĐ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Thông tin hóa đơn</h3>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mã phiếu</label>
            <input value={codePreview} readOnly className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ngày xuất *</label>
            <input type="date" value={ngayXuat} max={today()} onChange={e => setNgayXuat(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ký hiệu HĐ *</label>
            <input value={kyHieu} onChange={e => setKyHieu(e.target.value)} placeholder="VD: 1C26TAA"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Số HĐ *</label>
            <input value={soHD} onChange={e => setSoHD(e.target.value)} placeholder="VD: 0000089"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Khách hàng */}
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">Khách hàng</p>
            {customerId
              ? <p className="font-semibold text-green-700 text-sm">{customerName}</p>
              : <p className="text-sm text-gray-400 italic">Chưa chọn khách hàng</p>
            }
          </div>
          {/* MST */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mã số thuế KH *</label>
            <input value={maSoThue} onChange={e => setMaSoThue(e.target.value)}
              placeholder="MST 10 hoặc 13 chữ số"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {maSoThue && (maSoThue.length === 10 || maSoThue.length === 13)
              ? <p className="text-xs text-green-600 mt-1 flex items-center gap-1">✓ Định dạng hợp lệ</p>
              : maSoThue
              ? <p className="text-xs text-orange-500 mt-1">⚠ MST cần 10 hoặc 13 chữ số</p>
              : null}
          </div>
        </div>
      </div>

      {/* Section 2: Bảng sản phẩm */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Danh sách hàng hóa</p>
            <p className="text-xs text-gray-400 mt-0.5">Tick ✓ dòng nào xuất lên HĐ · Tên HĐ ★ in trên hóa đơn · SL HĐ có thể khác SL thực tế</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                <th className="px-3 py-2 w-8 text-center">✓</th>
                <th className="px-3 py-2 text-left w-24">Mã SP</th>
                <th className="px-3 py-2 text-left min-w-[160px]">Tên HĐ ★</th>
                <th className="px-3 py-2 text-center w-12">ĐVT</th>
                <th className="px-3 py-2 text-right w-20">SL thực</th>
                <th className="px-3 py-2 text-right w-20">SL HĐ</th>
                <th className="px-3 py-2 text-right w-28">Đơn giá</th>
                <th className="px-3 py-2 text-center w-20">% Thuế</th>
                <th className="px-3 py-2 text-right w-28">Tiền HH</th>
                <th className="px-3 py-2 text-right w-24">Tiền thuế</th>
                <th className="px-3 py-2 text-right w-28">Tổng cộng</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={12} className="text-center py-8 text-gray-400 text-sm">Chưa có sản phẩm</td></tr>
              )}
              {rows.map((r, idx) => {
                const { thanhTien, tienThue, tongTien } = calcRow(r);
                const hasMissingName = !r.tenHoaDon;
                const slMismatch = r.coLayHoaDon && r.slHoaDon !== r.slThucTe && r.slThucTe > 0;
                return (
                  <tr key={idx} className={`border-b ${r.coLayHoaDon ? '' : 'opacity-40 bg-gray-50'}`}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={r.coLayHoaDon}
                        onChange={e => updateRow(idx, 'coLayHoaDon', e.target.checked)}
                        className="accent-blue-600 w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 text-blue-600 font-medium text-xs">{r.productCode}</td>
                    <td className="px-3 py-2">
                      <input
                        value={r.tenHoaDon}
                        onChange={e => updateRow(idx, 'tenHoaDon', e.target.value)}
                        disabled={!r.coLayHoaDon}
                        placeholder="Tên in trên HĐ"
                        className={`w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${r.coLayHoaDon ? 'border-green-300' : 'border-gray-200 bg-gray-50'}`}
                      />
                      {r.tenHoaDonList.length > 1 && r.coLayHoaDon && (
                        <button onClick={() => toggleTenHD(idx)}
                          className="mt-0.5 text-xs px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 cursor-pointer">
                          ★ {r.tenHoaDonList.find(n => n.invoiceName === r.tenHoaDon)?.isDefault ? 'Tên chính' : 'Tên phụ'} — bấm để đổi
                        </button>
                      )}
                      {hasMissingName && r.coLayHoaDon && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600">Chưa có tên ★</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">{r.dvt}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-400">{r.slThucTe}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min={1} step={1}
                        value={r.slHoaDon}
                        onChange={e => updateRow(idx, 'slHoaDon', Math.max(1, Math.round(Number(e.target.value) || 1)))}
                        disabled={!r.coLayHoaDon}
                        className={`w-full border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 ${slMismatch ? 'border-yellow-400 focus:ring-yellow-400' : 'border-gray-300 focus:ring-blue-400'}`}
                      />
                      {slMismatch && <p className="text-xs text-yellow-600 text-right">≠ SL thực</p>}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min={0}
                        value={r.donGia}
                        onChange={e => updateRow(idx, 'donGia', Math.max(0, Number(e.target.value) || 0))}
                        disabled={!r.coLayHoaDon}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select value={r.thueSuat} disabled={!r.coLayHoaDon}
                        onChange={e => updateRow(idx, 'thueSuat', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                        {[10, 8, 5, 0].map(v => <option key={v} value={v}>{v}%</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-700">{r.coLayHoaDon ? VND_NUM(thanhTien) : '—'}</td>
                    <td className="px-3 py-2 text-right text-xs text-orange-600">{r.coLayHoaDon ? VND_NUM(tienThue) : '—'}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-blue-700">{r.coLayHoaDon ? VND_NUM(tongTien) : '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => removeRow(idx)}
                        className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-2 border-t flex gap-4 text-xs text-gray-400">
          <span>✓ tick dòng cần xuất · bỏ tick = không tính vào HĐ VAT</span>
          <span>★ Tên HĐ = tên in trên hóa đơn</span>
          <span>SL HĐ có thể khác SL thực tế</span>
        </div>
      </div>

      {/* Section 3: Ghi chú + Tổng tiền */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Ghi chú nội bộ..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tiền hàng hóa (chưa VAT)</span>
            <span className="font-medium">{VND_NUM(tongTienHang)}đ</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tiền thuế VAT</span>
            <span className="text-orange-600 font-medium">{VND_NUM(tongTienThue)}đ</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-semibold text-gray-800">Tổng cộng (có VAT)</span>
            <span className="text-red-600 font-bold text-base">{VND_NUM(tongCong)}đ</span>
          </div>
          <div className="text-xs text-gray-400 pt-1">
            {activeRows.length} dòng xuất HĐ · {rows.length - activeRows.length} dòng không xuất
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3">
        <p className="text-xs text-orange-600 flex items-center gap-1">
          <span>ℹ</span> Sau khi lưu → đơn hàng được đánh dấu "Đã xuất HĐ" và không thể tạo phiếu trùng
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard/xuat-hd-vat"
            className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50">
            Huỷ bỏ
          </Link>
          <button onClick={handleSubmit} disabled={!canSave}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
            {saving ? 'Đang lưu...' : '💾 Lưu phiếu xuất'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewVatExportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>}>
      <NewVatExportForm />
    </Suspense>
  );
}
