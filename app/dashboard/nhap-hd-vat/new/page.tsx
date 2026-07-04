'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { vatPurchaseInvoiceApi } from '@/lib/vat-purchase-invoices';

const VND_NUM = (v: number) => Math.round(v).toLocaleString('vi-VN');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

interface FormRow {
  productId: number | null;
  productName: string;
  tenHoaDon: string;
  dvt: string;
  soLuong: number;
  donGia: number;
  thueSuat: number;
}

function calcRow(r: FormRow) {
  const thanhTien = Math.round(r.soLuong * r.donGia);
  const tienThue  = Math.round(thanhTien * r.thueSuat / 100);
  return { thanhTien, tienThue, tongTien: thanhTien + tienThue };
}

function NewNhapHdVatForm() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const poIdParam   = searchParams.get('purchaseOrderId');

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [successCode, setSuccessCode] = useState('');

  // Header
  const [codePreview, setCodePreview] = useState('NK-...');
  const [kyHieu, setKyHieu]     = useState('');
  const [soHD, setSoHD]         = useState('');
  const [ngayHoaDon, setNgayHoaDon] = useState(todayStr());
  const [notes, setNotes]       = useState('');
  const [invoiceType, setInvoiceType] = useState<'goods' | 'service'>('goods');

  // Supplier
  const [supplierId, setSupplierId]     = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [maSoThue, setMaSoThue]         = useState('');
  const [poId, setPoId]                 = useState<number | null>(null);
  const [poCode, setPoCode]             = useState('');

  // Rows
  const [rows, setRows] = useState<FormRow[]>([]);

  // Load prefill
  useEffect(() => {
    setLoading(true);
    const pid = poIdParam ? Number(poIdParam) : undefined;
    vatPurchaseInvoiceApi.getPrefill(pid)
      .then(res => {
        setCodePreview(res.codePreview);
        if (res.po) {
          setSupplierId(res.po.supplierId);
          setSupplierName(res.po.supplierName);
          setMaSoThue(res.po.maSoThue || '');
          setPoId(res.po.id);
          setPoCode(res.po.code);
        }
        setRows((res.rows || []).map((r: any) => ({
          productId:   r.productId ?? null,
          productName: r.productName || '',
          tenHoaDon:   r.tenHoaDon || r.productName || '',
          dvt:         r.dvt || '',
          soLuong:     r.soLuong ?? 1,
          donGia:      r.donGia ?? 0,
          thueSuat:    r.thueSuat ?? 10,
        })));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [poIdParam]);

  const updateRow = useCallback(<K extends keyof FormRow>(idx: number, key: K, val: FormRow[K]) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, {
      productId: null, productName: '', tenHoaDon: '',
      dvt: '', soLuong: 1, donGia: 0, thueSuat: 10,
    }]);
  }, []);

  const tongTienHang = rows.reduce((s, r) => s + calcRow(r).thanhTien, 0);
  const tongTienThue = rows.reduce((s, r) => s + calcRow(r).tienThue,  0);
  const tongCong     = tongTienHang + tongTienThue;

  const canSave = rows.length > 0
    && rows.every(r => r.tenHoaDon.trim() && r.soLuong > 0 && r.donGia >= 0)
    && kyHieu.trim() && soHD.trim() && supplierId
    && !saving;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      const res = await vatPurchaseInvoiceApi.create({
        kyHieu: kyHieu.trim(), soHD: soHD.trim(), ngayHoaDon,
        supplierId, maSoThue: maSoThue.trim() || undefined,
        purchaseOrderId: poId ?? undefined,
        invoiceType,
        notes: notes.trim() || undefined,
        rows: rows.map(r => ({
          productId: r.productId ?? undefined,
          tenHoaDon: r.tenHoaDon,
          dvt: r.dvt || undefined,
          soLuong: r.soLuong, donGia: r.donGia, thueSuat: r.thueSuat,
        })),
      });
      setSuccessCode(res.code);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>
  );

  if (successCode) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 w-80 text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900">Đã tạo phiếu {successCode}</p>
        <p className="text-sm text-gray-500">
          Phiếu đang ở trạng thái <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full text-xs font-medium">Nháp</span>.
          Vào chi tiết để xác nhận ghi nhận VATvao.
        </p>
        <div className="flex gap-2">
          <button onClick={() => router.push('/dashboard/nhap-hd-vat')}
            className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
            Danh sách
          </button>
          <button onClick={() => { setSuccessCode(''); setRows([]); setKyHieu(''); setSoHD(''); }}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700">
            Tạo thêm
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/nhap-hd-vat" className="text-gray-400 hover:text-gray-600">←</Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tạo phiếu nhập HĐ VAT đầu vào</h2>
          <p className="text-sm text-gray-400">Mã phiếu: <span className="text-blue-600 font-medium">{codePreview}</span></p>
        </div>
      </div>

      {poId && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Tạo từ đơn hàng nhập <strong>{poCode}</strong> · NCC: {supplierName}
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
            <input value={codePreview} readOnly
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ngày HĐ *</label>
            <input type="date" value={ngayHoaDon} max={todayStr()} onChange={e => setNgayHoaDon(e.target.value)}
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

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Loại hóa đơn</span>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button type="button"
              onClick={() => setInvoiceType('goods')}
              className={`px-4 py-1.5 font-medium transition-colors ${invoiceType === 'goods' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Hàng hóa
            </button>
            <button type="button"
              onClick={() => setInvoiceType('service')}
              className={`px-4 py-1.5 font-medium transition-colors border-l border-gray-300 ${invoiceType === 'service' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Dịch vụ
            </button>
          </div>
          {invoiceType === 'service' && (
            <span className="text-xs text-purple-600">VAT vào sẽ được tính riêng trong báo cáo</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">Nhà cung cấp</p>
            {supplierId
              ? <p className="font-semibold text-green-700 text-sm">{supplierName}</p>
              : <p className="text-sm text-gray-400 italic">Chưa chọn NCC</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">MST nhà cung cấp</label>
            <input value={maSoThue} onChange={e => setMaSoThue(e.target.value)}
              placeholder="MST NCC (10 hoặc 13 chữ số)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {maSoThue && (maSoThue.length === 10 || maSoThue.length === 13)
              ? <p className="text-xs text-green-600 mt-1">✓ Định dạng hợp lệ</p>
              : maSoThue
              ? <p className="text-xs text-orange-500 mt-1">⚠ MST cần 10 hoặc 13 chữ số</p>
              : null}
          </div>
        </div>
      </div>

      {/* Section 2: Bảng hàng hóa */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Danh sách hàng hóa</p>
            <p className="text-xs text-gray-400 mt-0.5">Tên HĐ = tên ghi trên hóa đơn giấy · SL và đơn giá theo HĐ</p>
          </div>
          <button onClick={addRow}
            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
            + Thêm dòng
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                <th className="px-3 py-2 text-left min-w-[180px]">Tên HĐ *</th>
                <th className="px-3 py-2 text-center w-16">ĐVT</th>
                <th className="px-3 py-2 text-right w-24">Số lượng</th>
                <th className="px-3 py-2 text-right w-32">Đơn giá</th>
                <th className="px-3 py-2 text-center w-20">% Thuế</th>
                <th className="px-3 py-2 text-right w-28">Tiền HH</th>
                <th className="px-3 py-2 text-right w-24">VATvao</th>
                <th className="px-3 py-2 text-right w-28">Tổng cộng</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400 text-sm">Chưa có hàng hóa</td></tr>
              )}
              {rows.map((r, idx) => {
                const { thanhTien, tienThue, tongTien } = calcRow(r);
                const missingName = !r.tenHoaDon.trim();
                return (
                  <tr key={idx} className="border-b">
                    <td className="px-3 py-2">
                      <input value={r.tenHoaDon} onChange={e => updateRow(idx, 'tenHoaDon', e.target.value)}
                        placeholder="Tên ghi trên hóa đơn"
                        className={`w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${missingName ? 'border-red-300' : 'border-gray-300'}`} />
                      {r.productName && r.productName !== r.tenHoaDon && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate" title={r.productName}>SP: {r.productName}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input value={r.dvt} onChange={e => updateRow(idx, 'dvt', e.target.value)}
                        placeholder="Cái"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={0.0001} step={0.001} value={r.soLuong}
                        onChange={e => updateRow(idx, 'soLuong', Math.max(0.001, Number(e.target.value) || 0.001))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={0} value={r.donGia}
                        onChange={e => updateRow(idx, 'donGia', Math.max(0, Number(e.target.value) || 0))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={r.thueSuat} onChange={e => updateRow(idx, 'thueSuat', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                        {[10, 8, 5, 0].map(v => <option key={v} value={v}>{v}%</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-700">{VND_NUM(thanhTien)}</td>
                    <td className="px-3 py-2 text-right text-xs text-orange-600">{VND_NUM(tienThue)}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-blue-700">{VND_NUM(tongTien)}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
            <span className="text-gray-600">Tiền hàng (chưa VAT)</span>
            <span className="font-medium">{VND_NUM(tongTienHang)}đ</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">VATvao (thuế GTGT đầu vào)</span>
            <span className="text-orange-600 font-medium">{VND_NUM(tongTienThue)}đ</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-semibold text-gray-800">Tổng cộng</span>
            <span className="text-red-600 font-bold text-base">{VND_NUM(tongCong)}đ</span>
          </div>
          <div className="text-xs text-gray-400 pt-1">{rows.length} dòng hàng hóa</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3">
        <p className="text-xs text-blue-600 flex items-center gap-1">
          <span>ℹ</span> Phiếu tạo xong ở trạng thái Nháp — vào chi tiết để xác nhận ghi nhận VATvao
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard/nhap-hd-vat"
            className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50">
            Huỷ bỏ
          </Link>
          <button onClick={handleSubmit} disabled={!canSave}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
            {saving ? 'Đang lưu...' : '💾 Lưu phiếu nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewNhapHdVatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>}>
      <NewNhapHdVatForm />
    </Suspense>
  );
}
