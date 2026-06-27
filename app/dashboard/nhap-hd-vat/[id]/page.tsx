'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { vatPurchaseInvoiceApi } from '@/lib/vat-purchase-invoices';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
const VND_NUM = (v: number) => Math.round(v).toLocaleString('vi-VN');

interface InvoiceDetail {
  id: number; code: string; kyHieu: string; soHD: string; ngayHoaDon: string;
  supplierId: number | null; supplierName: string | null; maSoThue: string | null;
  purchaseOrderId: number | null; purchaseOrderCode: string | null;
  tongTienHang: number; tongTienThue: number; tongCong: number;
  trangThai: string; overdueWarning: boolean;
  notes: string | null; cancelReason: string | null; cancelledAt: string | null;
  createdByName: string | null; createdAt: string;
  items: {
    id: number; productId: number | null; tenHoaDon: string; dvt: string | null;
    soLuong: number; donGia: number; thanhTien: number;
    thueSuat: number; tienThue: number; tongTien: number; sortOrder: number;
  }[];
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Nháp',        cls: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Đã ghi nhận', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Đã huỷ',      cls: 'bg-gray-100 text-gray-500' },
};

export default function NhapHdVatDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [data, setData]     = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  // Confirm modal
  const [showConfirm, setShowConfirm]   = useState(false);
  const [confirming, setConfirming]     = useState(false);

  // Cancel modal
  const [showCancel, setShowCancel]     = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling]     = useState(false);
  const [cancelError, setCancelError]   = useState('');

  const load = () => {
    setLoading(true);
    vatPurchaseInvoiceApi.getOne(Number(id))
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await vatPurchaseInvoiceApi.confirm(Number(id));
      setShowConfirm(false);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (cancelReason.trim().length < 5) { setCancelError('Lý do cần ít nhất 5 ký tự'); return; }
    setCancelling(true); setCancelError('');
    try {
      await vatPurchaseInvoiceApi.cancel(Number(id), { cancelReason: cancelReason.trim() });
      router.push('/dashboard/nhap-hd-vat');
    } catch (e: any) {
      setCancelError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>;
  if (error)   return <div className="p-6 text-red-500">{error}</div>;
  if (!data)   return <div className="p-6 text-gray-400">Không tìm thấy phiếu</div>;

  const st       = STATUS_CONFIG[data.trangThai] ?? { label: data.trangThai, cls: 'bg-gray-100 text-gray-500' };
  const isDraft  = data.trangThai === 'draft';
  const isActive = data.trangThai !== 'cancelled';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/nhap-hd-vat" className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{data.code}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
              {data.overdueWarning && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                  ⚠ Quá hạn kê khai
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">
              Tạo bởi {data.createdByName || '—'} · {new Date(data.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <button onClick={() => setShowConfirm(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
              ✓ Xác nhận ghi nhận
            </button>
          )}
          {isActive && (
            <button onClick={() => setShowCancel(true)}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm rounded-lg hover:bg-red-100 font-medium">
              Huỷ phiếu
            </button>
          )}
        </div>
      </div>

      {/* Overdue warning banner */}
      {data.overdueWarning && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <p className="font-medium">⚠ Phiếu chưa được ghi nhận sau 30 ngày từ ngày hóa đơn ({data.ngayHoaDon})</p>
          <p className="mt-1 text-red-600">Theo quy định thuế GTGT, hóa đơn đầu vào cần được kê khai trong vòng 6 tháng. Cần xác nhận sớm để tính vào VATvao hợp lệ.</p>
        </div>
      )}

      {/* Cancelled banner */}
      {data.trangThai === 'cancelled' && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700">Phiếu đã bị huỷ</p>
          {data.cancelledAt && <p>Ngày huỷ: {new Date(data.cancelledAt).toLocaleString('vi-VN')}</p>}
          <p>Lý do: {data.cancelReason}</p>
        </div>
      )}

      {/* Thông tin HĐ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400">Ngày HĐ</p>
            <p className="font-medium text-gray-900">{data.ngayHoaDon}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Ký hiệu / Số HĐ</p>
            <p className="font-medium">{data.kyHieu} — {data.soHD}</p>
          </div>
          {data.purchaseOrderCode && (
            <div>
              <p className="text-xs text-gray-400">Đơn hàng nhập</p>
              <Link href={`/dashboard/don-hang-nhap/${data.purchaseOrderId}`}
                className="text-blue-600 hover:underline text-sm font-medium">
                {data.purchaseOrderCode}
              </Link>
            </div>
          )}
          {data.notes && (
            <div>
              <p className="text-xs text-gray-400">Ghi chú</p>
              <p className="text-sm text-gray-700">{data.notes}</p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400">Nhà cung cấp</p>
            <p className="font-medium">{data.supplierName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Mã số thuế</p>
            <p className="font-mono font-medium">{data.maSoThue || '—'}</p>
          </div>
        </div>
      </div>

      {/* Bảng hàng hóa */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b">
          <p className="text-sm font-semibold text-gray-700">Hàng hóa ({data.items.length} dòng)</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
              <th className="px-4 py-2 text-left">Tên hàng hóa (HĐ)</th>
              <th className="px-4 py-2 text-center">ĐVT</th>
              <th className="px-4 py-2 text-right">Số lượng</th>
              <th className="px-4 py-2 text-right">Đơn giá</th>
              <th className="px-4 py-2 text-center">% Thuế</th>
              <th className="px-4 py-2 text-right">Tiền HH</th>
              <th className="px-4 py-2 text-right">VATvao</th>
              <th className="px-4 py-2 text-right">Tổng cộng</th>
            </tr>
          </thead>
          <tbody>
            {data.items.sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.tenHoaDon}</td>
                <td className="px-4 py-3 text-center text-gray-500 text-xs">{item.dvt || '—'}</td>
                <td className="px-4 py-3 text-right">{Number(item.soLuong).toLocaleString('vi-VN')}</td>
                <td className="px-4 py-3 text-right">{VND_NUM(item.donGia)}đ</td>
                <td className="px-4 py-3 text-center">{item.thueSuat}%</td>
                <td className="px-4 py-3 text-right text-gray-700">{VND_NUM(item.thanhTien)}đ</td>
                <td className="px-4 py-3 text-right text-orange-600">{VND_NUM(item.tienThue)}đ</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{VND_NUM(item.tongTien)}đ</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t font-semibold text-sm">
              <td colSpan={5} className="px-4 py-3 text-gray-600">Tổng cộng</td>
              <td className="px-4 py-3 text-right text-gray-800">{VND(data.tongTienHang)}</td>
              <td className="px-4 py-3 text-right text-orange-600">{VND(data.tongTienThue)}</td>
              <td className="px-4 py-3 text-right text-red-600 text-base">{VND(data.tongCong)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">Xác nhận ghi nhận {data.code}</h3>
            <p className="text-sm text-gray-500">
              Phiếu sẽ chuyển sang trạng thái <strong>Đã ghi nhận</strong> và được tính vào
              tổng VATvao khấu trừ thuế GTGT. Sau khi xác nhận vẫn có thể huỷ nếu cần.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium">VATvao phiếu này: {VND(data.tongTienThue)}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50">
                Huỷ bỏ
              </button>
              <button onClick={handleConfirm} disabled={confirming}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 font-medium">
                {confirming ? 'Đang xác nhận...' : 'Xác nhận ghi nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">Huỷ phiếu {data.code}</h3>
            <p className="text-sm text-gray-500">
              Phiếu sẽ bị huỷ và không còn được tính vào VATvao. Dữ liệu vẫn được giữ nguyên.
            </p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Lý do huỷ * (tối thiểu 5 ký tự)</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                placeholder="Nhập lý do huỷ phiếu..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
              <p className="text-xs text-gray-400 mt-0.5">{cancelReason.length}/5 ký tự tối thiểu</p>
            </div>
            {cancelError && <p className="text-sm text-red-500">{cancelError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCancel(false); setCancelReason(''); setCancelError(''); }}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50">
                Đóng
              </button>
              <button onClick={handleCancel} disabled={cancelling || cancelReason.trim().length < 5}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40 font-medium">
                {cancelling ? 'Đang huỷ...' : 'Xác nhận huỷ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
